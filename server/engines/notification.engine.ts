/**
 * server/engines/notification.engine.ts
 *
 * Motor de processamento logístico INTELIGENTE.
 * Utiliza a Regra Cronológica (Linha do Tempo) para garantir que
 * demandas só sejam atualizadas com base em cargas faturadas APÓS a data do pedido.
 */

import { google } from "googleapis";
import { extractSpreadsheetId } from "./sync.engine";
import { getGoogleAuth, parseDataLimpa } from "./google.helpers";

// =============================================================================
// LÓGICA PRINCIPAL DE AUTOMAÇÃO
// =============================================================================

export async function rodarAutomacaoLogistica(urlRecebimento: string, urlDemandas: string) {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // 1. LÊ O BANCO DE DADOS BRUTO PARA PEGAR A DATA DE EMBARQUE (A âncora cronológica)
    const dbId = process.env.DB_SPREADSHEET_ID;
    if (!dbId) throw new Error("DB_SPREADSHEET_ID não definido no .env");

    const dbRes = await sheets.spreadsheets.values.get({ spreadsheetId: dbId, range: 'A:O' });
    const dbRows = dbRes.data.values || [];

    const dbRecords = dbRows.map(r => ({
      ref: String(r[0] || "").toUpperCase().trim(),
      dataEmbarque: parseDataLimpa(r[12]),           // Coluna M
      previsao: r[13] ? String(r[13]).trim() : "",   // Coluna N
      dataEntrega: r[14] ? String(r[14]).trim() : "" // Coluna O
    })).filter(r => r.ref);

    // 2. FUNÇÃO QUE PROCESSA CADA ABA (ALERTA E VENDA)
    // Retorna count total e breakdown por consultor
    const processarAba = async (abaNome: string): Promise<{
      count: number;
      porConsultor: Record<string, number>;
    }> => {
      let count = 0;
      const porConsultor: Record<string, number> = {};

      const demId = extractSpreadsheetId(urlDemandas);
      if (!demId) return { count, porConsultor };

      const demRes = await sheets.spreadsheets.values.get({ spreadsheetId: demId, range: `'${abaNome}'!A:G` });
      const demRows = demRes.data.values || [];

      for (let i = 1; i < demRows.length; i++) {
        const row = demRows[i];
        const dataRegistroRaw = row[0];
        const consultor = String(row[1] || "SEM CONSULTOR").toUpperCase().trim(); // Coluna B
        const ref = String(row[4] || "").toUpperCase().trim();
        const statusFisico = String(row[5] || "AGUARDANDO").toUpperCase().trim();

        if (!ref || statusFisico === "CHEGOU") continue;

        const dataRegistro = parseDataLimpa(dataRegistroRaw);
        if (!dataRegistro) continue;

        let bestStatus = "AGUARDANDO";

        for (let j = dbRecords.length - 1; j >= 1; j--) {
          const rec = dbRecords[j];

          if (rec.ref === ref && rec.dataEmbarque && rec.dataEmbarque.getTime() >= dataRegistro.getTime()) {
            if (rec.dataEntrega) {
              bestStatus = "CHEGOU";
            } else if (rec.previsao) {
              bestStatus = "PREVISÃO";
            } else {
              bestStatus = "FATURADA";
            }
            break;
          }
        }

        const hierarchy = { "AGUARDANDO": 0, "FATURADA": 1, "PREVISÃO": 2, "CHEGOU": 3 };
        const currentRank = hierarchy[statusFisico as keyof typeof hierarchy] || 0;
        const newRank = hierarchy[bestStatus as keyof typeof hierarchy] || 0;

        if (newRank > currentRank) {
          const rowNumber = i + 1;
          console.log(`[Engine] Evolução detectada na ref ${ref} (Linha ${rowNumber}): ${statusFisico} -> ${bestStatus} | Consultor: ${consultor}`);

          const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

          await sheets.spreadsheets.values.update({
            spreadsheetId: demId,
            range: `'${abaNome}'!F${rowNumber}:G${rowNumber}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [[bestStatus, hoje]] }
          });

          count++;
          porConsultor[consultor] = (porConsultor[consultor] || 0) + 1;
        }
      }

      return { count, porConsultor };
    };

    const alertas = await processarAba("DB-ALERTA_DE_DEMANDA");
    const vendas = await processarAba("DB-VENDA_FUTURA");

    return {
      success: true,
      alertasNotificados: alertas.count,
      alertasPorConsultor: alertas.porConsultor,
      vendasNotificadas: vendas.count,
      vendasPorConsultor: vendas.porConsultor,
      mensagem: `Processamento Logístico Concluído. ${alertas.count + vendas.count} estágios evoluídos na planilha.`
    };
  } catch (error: any) {
    console.error("❌ Erro fatal no processamento logístico:", error);
    return { success: false, erro: error.message };
  }
}