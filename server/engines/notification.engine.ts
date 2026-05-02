/**
 * server/engines/notification.engine.ts
 *
 * Motor de processamento logístico.
 * Compara o estoque com as demandas pendentes e atualiza a planilha.
 * O envio de e-mails é disparado pelo Apps Script ao detectar a mudança na planilha.
 */

import { google } from "googleapis";
import { 
  fetchLiveGoogleSheet, 
  extractSpreadsheetId 
} from "./sync.engine";

// =============================================================================
// FUNÇÕES AUXILIARES DE DATA E FORMATAÇÃO
// =============================================================================

function getDataHojeBR() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function parseDataBR(dataStr: string) {
  if (!dataStr || typeof dataStr !== 'string') return new Date(0); 
  const p = dataStr.split('/');
  if (p.length !== 3) return new Date(0);
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12, 0, 0);
}

const limparSKU = (sku: any) => String(sku || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();

// =============================================================================
// ATUALIZAÇÃO DA PLANILHA (O GATILHO)
// =============================================================================

async function atualizarStatusNaPlanilha(url: string, aba: string, rowNumber: number, novoStatus: string) {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) return;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const hoje = getDataHojeBR();

  // 🚀 Escreve na Coluna F (Status) e G (Data Status)
  // Isso "acorda" o Apps Script para enviar o e-mail
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${aba}'!F${rowNumber}:G${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[novoStatus, hoje]] }
  });
}

// =============================================================================
// LÓGICA PRINCIPAL DE AUTOMAÇÃO
// =============================================================================

export async function rodarAutomacaoLogistica(urlRecebimento: string, urlDemandas: string) {
  const estoque = await fetchLiveGoogleSheet(urlRecebimento, 'recebimento').catch(() => []);
  const alertas = await fetchLiveGoogleSheet(urlDemandas, 'demandas', 'DB-ALERTA_DE_DEMANDA').catch(() => []);
  const vendas = await fetchLiveGoogleSheet(urlDemandas, 'demandas', 'DB-VENDA_FUTURA').catch(() => []);

  const estoqueMap = new Map<string, any[]>();
  const pesoEstagio = { "AGUARDANDO": 0, "FATURADO": 1, "PREVISAO": 2, "CHEGOU": 3 };
  const hojeBR = getDataHojeBR();

  // 1. Mapeia o estoque atual
  for (const item of estoque) {
    if (!item.produtoSku) continue;
    const skuLimpo = limparSKU(item.produtoSku);
    let estagio = "FATURADO";
    let dataFormatada = "";
    
    if (item.dataEntrega) {
      estagio = "CHEGOU";
      dataFormatada = item.dataEntrega instanceof Date ? item.dataEntrega.toLocaleDateString('pt-BR') : item.dataEntrega;
    } else if (item.previsaoEntrega) {
      estagio = "PREVISAO";
      dataFormatada = item.previsaoEntrega instanceof Date ? item.previsaoEntrega.toLocaleDateString('pt-BR') : item.previsaoEntrega;
    }

    if (!estoqueMap.has(skuLimpo)) estoqueMap.set(skuLimpo, []);
    estoqueMap.get(skuLimpo)!.push({ estagio, dataFormatada });
  }

  const processarAba = async (lista: any[], tipo: string, abaNome: string) => {
    let count = 0;
    for (const row of lista) {
      const sku = limparSKU(row.referencia || row.REFERENCIA || row.REF);
      const statusAtual = String(row.status || "AGUARDANDO").toUpperCase().trim();
      const dataStatus = String(row.DATA_STATUS || "").trim();

      // Pula se já foi processado hoje
      if (statusAtual !== "AGUARDANDO" && dataStatus === hojeBR) continue;

      const movimentos = estoqueMap.get(sku);
      if (movimentos && statusAtual === "AGUARDANDO") {
        // Encontra o melhor estágio (Prioridade: Chegou > Previsão > Faturado)
        let melhorMov: any = null;
        let maiorPeso = -1;

        for (const mov of movimentos) {
          const peso = pesoEstagio[mov.estagio as keyof typeof pesoEstagio];
          if (peso > maiorPeso) {
            maiorPeso = peso;
            melhorMov = mov;
          }
        }

        if (melhorMov) {
          console.log(`[Engine] Notificando ${sku} -> ${melhorMov.estagio}`);
          await atualizarStatusNaPlanilha(urlDemandas, abaNome, row.rowNumber, melhorMov.estagio);
          count++;
        }
      }
    }
    return count;
  };

  const countAlertas = await processarAba(alertas, "ALERTA", "DB-ALERTA_DE_DEMANDA");
  const countVendas = await processarAba(vendas, "VENDA", "DB-VENDA_FUTURA");

  return {
    success: true,
    alertasNotificados: countAlertas,
    vendasNotificadas: countVendas,
    mensagem: `Processamento concluído. ${countAlertas + countVendas} itens atualizados na planilha.`
  };
}