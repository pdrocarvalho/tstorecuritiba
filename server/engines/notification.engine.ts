/**
 * server/engines/notification.engine.ts
 *
 * Motor de processamento logístico INTELIGENTE.
 * Utiliza a Regra Cronológica (Linha do Tempo) para garantir que
 * demandas só sejam atualizadas com base em cargas faturadas APÓS a data do pedido.
 */

import { google } from "googleapis";
import { extractSpreadsheetId } from "./sync.engine";

// =============================================================================
// FUNÇÕES AUXILIARES DE DATA E FORMATAÇÃO
// =============================================================================

function getGoogleAuth() {
  const client_email = process.env.GOOGLE_SERVICE_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!client_email || !private_key) throw new Error("Credenciais do Google ausentes.");
  return new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function parseDataLimpa(dataRaw: any) {
  if (!dataRaw) return null;
  const str = String(dataRaw).trim();
  if (str.includes('/')) {
    const parts = str.split(/[/\s:-]/);
    if (parts.length >= 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);
      if (p0 > 12) return new Date(p2, p1 - 1, p0); // DD/MM/YYYY
      if (p1 > 12) return new Date(p2, p0 - 1, p1); // MM/DD/YYYY
      return new Date(p2, p1 - 1, p0); // Padrão BR
    }
  }
  const d = new Date(dataRaw);
  if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return null;
}

// =============================================================================
// LÓGICA PRINCIPAL DE AUTOMAÇÃO
// =============================================================================

export async function rodarAutomacaoLogistica(urlRecebimento: string, urlDemandas: string) {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // 1. LÊ O BANCO DE DADOS BRUTO PARA PEGAR A DATA DE EMBARQUE (A âncora cronológica)
    const dbId = "1uu6N6f21Ct3hXMCbYwUVqK6whSavDVc6ICBsXoeRzyo";
    const dbRes = await sheets.spreadsheets.values.get({ spreadsheetId: dbId, range: 'A:O' });
    const dbRows = dbRes.data.values || [];

    const dbRecords = dbRows.map(r => ({
      ref: String(r[0] || "").toUpperCase().trim(),
      dataEmbarque: parseDataLimpa(r[12]),           // Coluna M
      previsao: r[13] ? String(r[13]).trim() : "",   // Coluna N
      dataEntrega: r[14] ? String(r[14]).trim() : "" // Coluna O
    })).filter(r => r.ref);

    // 2. FUNÇÃO QUE PROCESSA CADA ABA (ALERTA E VENDA)
    const processarAba = async (abaNome: string) => {
      let count = 0;
      const demId = extractSpreadsheetId(urlDemandas);
      if (!demId) return 0;

      const demRes = await sheets.spreadsheets.values.get({ spreadsheetId: demId, range: `'${abaNome}'!A:G` });
      const demRows = demRes.data.values || [];

      for (let i = 1; i < demRows.length; i++) { // Começa do 1 para pular o cabeçalho
        const row = demRows[i];
        const dataRegistroRaw = row[0]; // Coluna A (Data do Pedido)
        const ref = String(row[4] || "").toUpperCase().trim(); // Coluna E (Referência)
        const statusFisico = String(row[5] || "AGUARDANDO").toUpperCase().trim(); // Coluna F

        // Se a linha não tem referência ou já chegou ao final da jornada, ignoramos.
        if (!ref || statusFisico === "CHEGOU") continue; 

        const dataRegistro = parseDataLimpa(dataRegistroRaw);
        if (!dataRegistro) continue;

        let bestStatus = "AGUARDANDO";

        // BUSCA CRONOLÓGICA (De baixo pra cima para pegar a carga mais recente)
        for (let j = dbRecords.length - 1; j >= 1; j--) {
          const rec = dbRecords[j];
          
          // A MÁGICA: A carga pertence a essa referência E foi embarcada DEPOIS ou NO MESMO DIA do pedido?
          if (rec.ref === ref && rec.dataEmbarque && rec.dataEmbarque.getTime() >= dataRegistro.getTime()) {
            if (rec.dataEntrega) {
              bestStatus = "CHEGOU";
            } else if (rec.previsao) {
              bestStatus = "PREVISÃO";
            } else {
              bestStatus = "FATURADA";
            }
            break; // Achou a carga exata, para a busca
          }
        }

        // HIERARQUIA DE EVOLUÇÃO (Garante que um produto não "ande para trás")
        const hierarchy = { "AGUARDANDO": 0, "FATURADA": 1, "PREVISÃO": 2, "CHEGOU": 3 };
        const currentRank = hierarchy[statusFisico as keyof typeof hierarchy] || 0;
        const newRank = hierarchy[bestStatus as keyof typeof hierarchy] || 0;

        // Se o status evoluiu na jornada logística
        if (newRank > currentRank) {
          const rowNumber = i + 1; // Ajusta o índice do array para a linha real da planilha
          console.log(`[Engine] Evolução detectada na ref ${ref} (Linha ${rowNumber}): ${statusFisico} -> ${bestStatus}`);
          
          const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          
          // Atualiza a Coluna F (Novo Status) e a Coluna G (Substitui o carimbo antigo pela data de hoje)
          // Isso destrava o envio do próximo e-mail pelo Apps Script!
          await sheets.spreadsheets.values.update({
            spreadsheetId: demId,
            range: `'${abaNome}'!F${rowNumber}:G${rowNumber}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [[bestStatus, hoje]] }
          });
          count++;
        }
      }
      return count;
    };

    const countAlertas = await processarAba("DB-ALERTA_DE_DEMANDA");
    const countVendas = await processarAba("DB-VENDA_FUTURA");

    return {
      success: true,
      alertasNotificados: countAlertas,
      vendasNotificadas: countVendas,
      mensagem: `Processamento Logístico Concluído. ${countAlertas + countVendas} estágios evoluídos na planilha.`
    };
  } catch (error: any) {
    console.error("❌ Erro fatal no processamento logístico:", error);
    return { success: false, erro: error.message };
  }
}