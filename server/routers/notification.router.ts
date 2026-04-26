/**
 * server/routers/notification.router.ts
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc"; 
import { google } from "googleapis";
import { 
  fetchLiveGoogleSheet, 
  addRowToSheet, 
  updateSheetRow,
  updateFullRow,
  deleteSheetRow,
  extractSpreadsheetId
} from "../engines/sync.engine";

import { sendAvariaNotification, sendDemandaNotification } from "../services/gmail.service"; 

const validateAdminPin = (pinEnviado: string) => {
  const pinServidor = process.env.MANAGER_PIN || "0000";
  if (pinEnviado !== pinServidor) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha de gerente incorreta." });
  }
};

async function atualizarStatusPlanilha(url: string, aba: string, rowNumber: number, novoStatus: string) {
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
  
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${aba}'!E${rowNumber}`, 
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[novoStatus]] }
  });
}

export const notificationsRouter = router({
  
  // --------------------------------------------------------
  // 🤖 O CÉREBRO: AUTOMAÇÃO DE DEMANDAS (VERSÃO BLINDADA)
  // --------------------------------------------------------
  rodarAutomacaoDemandas: publicProcedure
    .input(z.object({ 
      urlRecebimento: z.string(), 
      urlDemandas: z.string() 
    }))
    .mutation(async ({ input }) => {
      const estoque = await fetchLiveGoogleSheet(input.urlRecebimento, 'recebimento').catch(() => []);
      const alertas = await fetchLiveGoogleSheet(input.urlDemandas, 'demandas', 'DB-ALERTA_DE_DEMANDA').catch(() => []);
      const vendas = await fetchLiveGoogleSheet(input.urlDemandas, 'demandas', 'DB-VENDA_FUTURA').catch(() => []);

      const estoqueMap = new Map<string, any>();
      const pesoEstagio = { "AGUARDANDO": 0, "FATURADO": 1, "PREVISAO": 2, "CHEGOU": 3 };

      // 🚀 FUNÇÃO DE LIMPEZA: Remove tudo que não é letra ou número para garantir o match
      const limparSKU = (sku: any) => String(sku || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();

      for (const item of estoque) {
        if (!item.produtoSku) continue;
        const skuLimpo = limparSKU(item.produtoSku);
        
        // Se o SKU existe no estoque, o estágio base é FATURADO (mesmo sem datas)
        let estagio = "FATURADO";
        let dataFormatada = "";
        
        if (item.dataEntrega) {
          estagio = "CHEGOU";
          dataFormatada = item.dataEntrega instanceof Date ? item.dataEntrega.toLocaleDateString('pt-BR') : item.dataEntrega;
        } else if (item.previsaoEntrega) {
          estagio = "PREVISAO";
          dataFormatada = item.previsaoEntrega instanceof Date ? item.previsaoEntrega.toLocaleDateString('pt-BR') : item.previsaoEntrega;
        }

        const atual = estoqueMap.get(skuLimpo);
        if (!atual || pesoEstagio[estagio as keyof typeof pesoEstagio] > pesoEstagio[atual.estagio as keyof typeof pesoEstagio]) {
          estoqueMap.set(skuLimpo, {
            estagio,
            notaFiscal: item.notaFiscal || "Verificar no Sistema",
            previsao: estagio === "PREVISAO" ? dataFormatada : "",
            dataChegada: estagio === "CHEGOU" ? dataFormatada : "",
            quantidade: item.quantidade || 0
          });
        }
      }

      const processar = async (lista: any[], tipo: "ALERTA" | "VENDA", abaNome: string) => {
        let notificados = 0;
        
        for (const row of lista) {
          if (!row.referencia) continue;
          const skuDemandaLimpo = limparSKU(row.referencia);
          const statusAtual = String(row.status || "AGUARDANDO").trim().toUpperCase();
          
          const itemEstoque = estoqueMap.get(skuDemandaLimpo);
          
          if (itemEstoque) {
            const pesoAtual = pesoEstagio[statusAtual as keyof typeof pesoEstagio] || 0;
            const pesoNovo = pesoEstagio[itemEstoque.estagio as keyof typeof pesoEstagio] || 0;

            // Se o que achamos no estoque é "maior" do que o que está na planilha, avisa!
            if (pesoNovo > pesoAtual) {
              await sendDemandaNotification(tipo, itemEstoque.estagio as any, {
                consultor: row.consultor || "Consultor",
                cliente: row.cliente || "Cliente",
                contato: row.contato || "",
                referencia: row.referencia // Mantemos a original para o e-mail
              }, itemEstoque);
              
              await atualizarStatusPlanilha(input.urlDemandas, abaNome, row.rowNumber, itemEstoque.estagio);
              notificados++;
            }
          }
        }
        return notificados;
      };

      const nAlertas = await processar(alertas, "ALERTA", "DB-ALERTA_DE_DEMANDA");
      const nVendas = await processar(vendas, "VENDA", "DB-VENDA_FUTURA");

      return { alertasNotificados: nAlertas, vendasNotificadas: nVendas };
    }),

  // --- MANTIDAS ---
  getLiveData: publicProcedure.input(z.object({ url: z.string(), mode: z.enum(["recebimento", "avarias", "demandas"]).optional().default("recebimento") })).query(async ({ input }) => { return await fetchLiveGoogleSheet(input.url, input.mode); }),
  saveDemanda: publicProcedure.input(z.object({ url: z.string(), aba: z.string(), dados: z.array(z.any()) })).mutation(async ({ input }) => { const result = await addRowToSheet(input.url, input.dados, input.aba); return { success: true, result }; }),
  addAvaria: publicProcedure.input(z.object({ url: z.string(), row: z.array(z.any()) })).mutation(async ({ input }) => { const result = await addRowToSheet(input.url, input.row); const data = { codAvaria: input.row[2], fabrica: input.row[1], ref: input.row[3], qtde: input.row[5], descricao: input.row[4], motivo: input.row[7], responsavel: input.row[8], tratativa: input.row[10] || 'PENDENTE', status: input.row[12] || 'PENDENTE' }; sendAvariaNotification('CRIADA', data); return result; }),
  updateAvaria: publicProcedure.input(z.object({ url: z.string(), rowNumber: z.number(), columnLetter: z.string(), newValue: z.string() })).mutation(async ({ input }) => { return await updateSheetRow(input.url, input.rowNumber, input.columnLetter, input.newValue); }),
  editAvariaFull: publicProcedure.input(z.object({ url: z.string(), rowNumber: z.number(), row: z.array(z.any()), pin: z.string() })).mutation(async ({ input }) => { validateAdminPin(input.pin); const rows = await fetchLiveGoogleSheet(input.url, 'avarias'); const previousData = rows.find((r: any) => r.rowNumber === input.rowNumber); const result = await updateFullRow(input.url, input.rowNumber, input.row); const data = { codAvaria: input.row[2], fabrica: input.row[1], ref: input.row[3], qtde: input.row[5], descricao: input.row[4], motivo: input.row[7], responsavel: input.row[8], tratativa: input.row[10], status: input.row[12] }; sendAvariaNotification('EDITADA', data, previousData); return result; }),
  deleteAvariaRow: publicProcedure.input(z.object({ url: z.string(), rowNumber: z.number(), pin: z.string() })).mutation(async ({ input }) => { validateAdminPin(input.pin); const rows = await fetchLiveGoogleSheet(input.url, 'avarias'); const target = rows.find((r: any) => r.rowNumber === input.rowNumber); const result = await deleteSheetRow(input.url, input.rowNumber); if (target) sendAvariaNotification('EXCLUÍDA', target); return result; }),
});