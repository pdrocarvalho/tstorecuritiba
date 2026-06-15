/**
 * server/engines/notification.engine.ts
 *
 * Motor de processamento logístico INTELIGENTE.
 * Utiliza a Regra Cronológica (Linha do Tempo) para garantir que
 * demandas só sejam atualizadas com base em cargas faturadas APÓS a data do pedido.
 *
 * Agora utiliza o módulo cross-reference.ts para evitar duplicação (ARCH-03).
 */

import { google } from "googleapis";
import { extractSpreadsheetId } from "./sheets-client";
import { getGoogleAuth, parseDataLimpa } from "./google.helpers";
import { fetchDbRecords, determinarStatusDemanda } from "./cross-reference";

// =============================================================================
// LÓGICA PRINCIPAL DE AUTOMAÇÃO
// =============================================================================

export async function rodarAutomacaoLogistica(urlRecebimento: string, urlDemandas: string) {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // 1. LÊ O BANCO DE DADOS BRUTO (usando o módulo compartilhado)
    const dbRecords = await fetchDbRecords(sheets);

    // 2. FUNÇÃO QUE PROCESSA CADA ABA (ALERTA E VENDA)
    const processarAba = async (abaNome: string): Promise<{
      count: number;
      porConsultor: Record<string, number>;
      temRegistros: boolean;
    }> => {
      let count = 0;
      const porConsultor: Record<string, number> = {};

      const demId = extractSpreadsheetId(urlDemandas);
      if (!demId) return { count, porConsultor, temRegistros: false };

      const demRes = await sheets.spreadsheets.values.get({ spreadsheetId: demId, range: `'${abaNome}'!A:G` });
      const demRows = demRes.data.values || [];

      const temRegistros = demRows.length > 1;

      for (let i = 1; i < demRows.length; i++) {
        const row = demRows[i];
        const dataRegistroRaw = row[0];
        const consultor = String(row[1] || "SEM CONSULTOR").toUpperCase().trim();
        const ref = String(row[4] || "").toUpperCase().trim();
        const statusFisico = String(row[5] || "AGUARDANDO").toUpperCase().trim();

        if (!ref || statusFisico === "CHEGOU") continue;

        const dataRegistro = parseDataLimpa(dataRegistroRaw);
        if (!dataRegistro) continue;

        // Usa a função compartilhada para determinar o status
        const bestStatus = determinarStatusDemanda(ref, dataRegistro, dbRecords);

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

      return { count, porConsultor, temRegistros };
    };

    const alertas = await processarAba("DB-ALERTA_DE_DEMANDA");
    const vendas = await processarAba("DB-VENDA_FUTURA");

    return {
      success: true,
      alertasNotificados: alertas.count,
      alertasPorConsultor: alertas.porConsultor,
      alertasTemRegistros: alertas.temRegistros,
      vendasNotificadas: vendas.count,
      vendasPorConsultor: vendas.porConsultor,
      vendasTemRegistros: vendas.temRegistros,
      mensagem: `Processamento Logístico Concluído. ${alertas.count + vendas.count} estágios evoluídos na planilha.`
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("[NotificationEngine] Erro geral ao disparar webhook:", error.message);
      return { success: false, erro: error.message };
    } else {
      console.error("[NotificationEngine] Erro geral ao disparar webhook:", error);
      return { success: false, erro: "Erro desconhecido" };
    }
  }
}