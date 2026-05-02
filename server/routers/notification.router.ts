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

/**
 * 🛠️ Obtém a data de hoje corrigida para o fuso de Brasília
 */
function getDataHojeBR() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * 🛠️ Converte uma string "DD/MM/YYYY" para um objeto Date comparável
 * Retorna uma data muito antiga se a string for vazia/inválida.
 */
function parseDataBR(dataStr: string) {
  if (!dataStr || typeof dataStr !== 'string') return new Date(0); 
  const p = dataStr.split('/');
  if (p.length !== 3) return new Date(0);
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12, 0, 0);
}

/**
 * ⚠️ ATENÇÃO: As colunas andaram! Agora STATUS = F e DATA STATUS = G
 */
async function atualizarStatusEData(url: string, aba: string, rowNumber: number, novoStatus: string) {
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

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${aba}'!F${rowNumber}:G${rowNumber}`, // 🚀 Ajustado de E:F para F:G
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[novoStatus, hoje]] }
  });
}

export const notificationsRouter = router({
  
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
      const hojeBR = getDataHojeBR();
      const limparSKU = (sku: any) => String(sku || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();

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

        const atual = estoqueMap.get(skuLimpo);
        if (!atual || pesoEstagio[estagio as keyof typeof pesoEstagio] > pesoEstagio[atual.estagio as keyof typeof pesoEstagio]) {
          estoqueMap.set(skuLimpo, {
            estagio,
            notaFiscal: item.notaFiscal || "Verificar no Sistema",
            previsao: estagio === "PREVISAO" ? dataFormatada : "",
            dataChegada: estagio === "CHEGOU" ? dataFormatada : "",
            quantidade: item.quantidade || 0,
            dataRelevanteEstoqueStr: dataFormatada 
          });
        }
      }

      const processar = async (lista: any[], tipo: "ALERTA" | "VENDA", abaNome: string) => {
        let countAtivosHoje = 0;
        let consultoresSet = new Set<string>();
        
        for (const row of lista) {
          // Captura as chaves independente de como o motor as nomeou
          const sku = row.referencia || row.REFERENCIA || row.REF || row.REF_;
          if (!sku) continue;

          const skuDemandaLimpo = limparSKU(sku);
          const statusAtual = String(row.status || row.STATUS || "AGUARDANDO").trim().toUpperCase();
          const dataStatus = String(row.DATA_STATUS || row.DATASTATUS || "").trim();
          const consultorOriginal = row.consultor || row.CONSULTOR || "";

          // 1. Persistência Diária (Filtro por data correta BR)
          if (statusAtual !== "AGUARDANDO" && dataStatus === hojeBR) {
            countAtivosHoje++;
            if (consultorOriginal) {
              consultoresSet.add(String(consultorOriginal).split(' ')[0].toUpperCase());
            }
            continue; 
          }

          // 2. Novo Match com ⏳ FILTRO INTELIGENTE (REGRA DE LOGÍSTICA)
          const itemEstoque = estoqueMap.get(skuDemandaLimpo);
          if (itemEstoque && statusAtual === "AGUARDANDO") {
              
              // 🚀 LÊ A DATA CORRETAMENTE DO MOTOR (Seja 'data' ou 'dataRegistro' dependendo do seu sync engine)
              const dataDemandaStr = String(row.data || row.dataRegistro || row.DATA || "").trim();
              const dataDemanda = parseDataBR(dataDemandaStr);
              const dataEstoque = parseDataBR(itemEstoque.dataRelevanteEstoqueStr);

              /**
               * 🚀 REGRA RÍGIDA:
               * Se for CHEGOU (Estágio 3), a data de entrega DEVE ser maior ou igual à data do registro da demanda.
               * Se a data da demanda for 1970 (vazia/inválida), ele aprova por segurança.
               * Para FATURADO/PREVISÃO (Estágios 1 e 2), mantemos a aprovação pois o caminhão ainda não encostou, então serve para a demanda de hoje.
               */
              let isValido = false;
              if (itemEstoque.estagio === "FATURADO" || itemEstoque.estagio === "PREVISAO") {
                  isValido = true;
              } else if (itemEstoque.estagio === "CHEGOU") {
                  isValido = (dataEstoque >= dataDemanda || dataDemanda.getTime() === 0);
              }

              if (isValido) {
                  try {
                    await sendDemandaNotification(tipo, itemEstoque.estagio as any, {
                      consultor: consultorOriginal || "CONSULTOR",
                      cliente: row.cliente || row.CLIENTE || "CLIENTE",
                      contato: row.contato || row.CONTATO || "",
                      referencia: sku
                    }, itemEstoque);
                  } catch (e) {
                    console.error("[Robô] Falha ao disparar e-mail, mas a planilha será atualizada.");
                  }
                  
                  await atualizarStatusEData(input.urlDemandas, abaNome, row.rowNumber, itemEstoque.estagio);
                  
                  countAtivosHoje++;
                  if (consultorOriginal) {
                    consultoresSet.add(String(consultorOriginal).split(' ')[0].toUpperCase());
                  }
              }
          }
        }

        // 3. Formatação da Mensagem
        let saudacao = "EQUIPE";
        const consultoresArr = Array.from(consultoresSet);
        if (consultoresArr.length === 1) {
          saudacao = consultoresArr[0];
        } else if (consultoresArr.length >= 2) {
          saudacao = consultoresArr.slice(0, 2).join(" E ");
        }

        const nFormatado = countAtivosHoje.toString().padStart(2, '0');
        const txtNotif = countAtivosHoje === 1 ? "notificação" : "notificações";
        const mensagemFinal = `${saudacao}, você tem ${nFormatado} ${txtNotif}.`;

        return { count: countAtivosHoje, mensagem: mensagemFinal };
      };

      const resAlertas = await processar(alertas, "ALERTA", "DB-ALERTA_DE_DEMANDA");
      const resVendas = await processar(vendas, "VENDA", "DB-VENDA_FUTURA");

      return { 
        alertasNotificados: resAlertas.count,
        alertasMensagem: resAlertas.mensagem,
        vendasNotificadas: resVendas.count,
        vendasMensagem: resVendas.mensagem
      };
    }),

  // --- RESTANTE DAS ROTAS MANTIDAS ---
  getLiveData: publicProcedure.input(z.object({ url: z.string(), mode: z.enum(["recebimento", "avarias", "demandas"]).optional().default("recebimento") })).query(async ({ input }) => { return await fetchLiveGoogleSheet(input.url, input.mode); }),
  saveDemanda: publicProcedure.input(z.object({ url: z.string(), aba: z.string(), dados: z.array(z.any()) })).mutation(async ({ input }) => { const result = await addRowToSheet(input.url, input.dados, input.aba); return { success: true, result }; }),
  addAvaria: publicProcedure.input(z.object({ url: z.string(), row: z.array(z.any()) })).mutation(async ({ input }) => { const result = await addRowToSheet(input.url, input.row); const data = { codAvaria: input.row[2], fabrica: input.row[1], ref: input.row[3], qtde: input.row[5], descricao: input.row[4], motivo: input.row[7], responsavel: input.row[8], tratativa: input.row[10] || 'PENDENTE', status: input.row[12] || 'PENDENTE' }; sendAvariaNotification('CRIADA', data); return result; }),
  updateAvaria: publicProcedure.input(z.object({ url: z.string(), rowNumber: z.number(), columnLetter: z.string(), newValue: z.string() })).mutation(async ({ input }) => { return await updateSheetRow(input.url, input.rowNumber, input.columnLetter, input.newValue); }),
  editAvariaFull: publicProcedure.input(z.object({ url: z.string(), rowNumber: z.number(), row: z.array(z.any()), pin: z.string() })).mutation(async ({ input }) => { validateAdminPin(input.pin); const rows = await fetchLiveGoogleSheet(input.url, 'avarias'); const previousData = rows.find((r: any) => r.rowNumber === input.rowNumber); const result = await updateFullRow(input.url, input.rowNumber, input.row); const data = { codAvaria: input.row[2], fabrica: input.row[1], ref: input.row[3], qtde: input.row[5], descricao: input.row[4], motivo: input.row[7], responsavel: input.row[8], tratativa: input.row[10], status: input.row[12] }; sendAvariaNotification('EDITADA', data, previousData); return result; }),
  deleteAvariaRow: publicProcedure.input(z.object({ url: z.string(), rowNumber: z.number(), pin: z.string() })).mutation(async ({ input }) => { validateAdminPin(input.pin); const rows = await fetchLiveGoogleSheet(input.url, 'avarias'); const target = rows.find((r: any) => r.rowNumber === input.rowNumber); const result = await deleteSheetRow(input.url, input.rowNumber); if (target) sendAvariaNotification('EXCLUÍDA', target); return result; }),
});