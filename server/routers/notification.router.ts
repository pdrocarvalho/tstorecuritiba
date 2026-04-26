/**
 * server/routers/notification.router.ts
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc"; 
import { 
  fetchLiveGoogleSheet, 
  addRowToSheet, 
  updateSheetRow,
  updateFullRow,
  deleteSheetRow
} from "../engines/sync.engine";
// 🚀 Importa a função de alerta de avaria do SEU serviço
import { sendAvariaNotification } from "../services/gmail.service"; 

const validateAdminPin = (pinEnviado: string) => {
  const pinServidor = process.env.MANAGER_PIN || "0000";
  if (pinEnviado !== pinServidor) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha de gerente incorreta." });
  }
};

export const notificationsRouter = router({
  // 🚀 ATUALIZADO: Agora aceita o modo "demandas" também
  getLiveData: publicProcedure
    .input(z.object({ 
        url: z.string(), 
        mode: z.enum(["recebimento", "avarias", "demandas"]).optional().default("recebimento") 
    }))
    .query(async ({ input }) => {
      return await fetchLiveGoogleSheet(input.url, input.mode);
    }),

  // 🚀 NOVA ROTA: Salva Alertas e Vendas Futuras
  saveDemanda: publicProcedure
    .input(z.object({ 
        url: z.string(), 
        aba: z.string(), // Qual aba do sheets? (DB-ALERTA_DE_DEMANDA ou DB-VENDA_FUTURA)
        dados: z.array(z.any()) 
    }))
    .mutation(async ({ input }) => {
      // Repassa para o nosso engine que agora sabe salvar em abas específicas
      const result = await addRowToSheet(input.url, input.dados, input.aba);
      return { success: true, result };
    }),

  addAvaria: publicProcedure
    .input(z.object({ url: z.string(), row: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      const result = await addRowToSheet(input.url, input.row);
      
      // Dispara o E-mail após salvar no Sheets (CRIADA)
      const data = { 
          codAvaria: input.row[2], fabrica: input.row[1], ref: input.row[3], 
          qtde: input.row[5], descricao: input.row[4], motivo: input.row[7], 
          responsavel: input.row[8], tratativa: input.row[10] || 'PENDENTE',
          status: input.row[12] || 'PENDENTE'
      };
      sendAvariaNotification('CRIADA', data); 
      
      return result;
    }),

  updateAvaria: publicProcedure
    .input(z.object({ url: z.string(), rowNumber: z.number(), columnLetter: z.string(), newValue: z.string() }))
    .mutation(async ({ input }) => {
      return await updateSheetRow(input.url, input.rowNumber, input.columnLetter, input.newValue);
    }),

  editAvariaFull: publicProcedure
    .input(z.object({ url: z.string(), rowNumber: z.number(), row: z.array(z.any()), pin: z.string() }))
    .mutation(async ({ input }) => {
      validateAdminPin(input.pin);
      
      // 🚀 LÊ OS DADOS ANTES DA EDIÇÃO
      const rows = await fetchLiveGoogleSheet(input.url, 'avarias');
      const previousData = rows.find((r: any) => r.rowNumber === input.rowNumber);
      
      const result = await updateFullRow(input.url, input.rowNumber, input.row);
      
      // Dispara o E-mail de Edição, enviando também os dados anteriores
      const data = { 
          codAvaria: input.row[2], fabrica: input.row[1], ref: input.row[3], 
          qtde: input.row[5], descricao: input.row[4], motivo: input.row[7], 
          responsavel: input.row[8], tratativa: input.row[10], status: input.row[12]
      };
      sendAvariaNotification('EDITADA', data, previousData);
      
      return result;
    }),

  deleteAvariaRow: publicProcedure
    .input(z.object({ url: z.string(), rowNumber: z.number(), pin: z.string() }))
    .mutation(async ({ input }) => {
      validateAdminPin(input.pin);
      
      // Lê os dados ANTES de deletar para colocar no corpo do e-mail
      const rows = await fetchLiveGoogleSheet(input.url, 'avarias');
      const target = rows.find((r: any) => r.rowNumber === input.rowNumber);
      
      const result = await deleteSheetRow(input.url, input.rowNumber);
      
      // Dispara o E-mail de Exclusão
      if (target) sendAvariaNotification('EXCLUÍDA', target);
      
      return result;
    }),
});