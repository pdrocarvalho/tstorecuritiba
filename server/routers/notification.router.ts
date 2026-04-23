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
  getLiveData: publicProcedure
    .input(z.object({ url: z.string(), mode: z.enum(["recebimento", "avarias"]).optional().default("recebimento") }))
    .query(async ({ input }) => {
      return await fetchLiveGoogleSheet(input.url, input.mode);
    }),

  addAvaria: publicProcedure
    .input(z.object({ url: z.string(), row: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      const result = await addRowToSheet(input.url, input.row);
      
      // Dispara o E-mail após salvar no Sheets
      const data = { codAvaria: input.row[2], fabrica: input.row[1], ref: input.row[3], qtde: input.row[5], descricao: input.row[4], motivo: input.row[7], responsavel: input.row[8] };
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
      
      const result = await updateFullRow(input.url, input.rowNumber, input.row);
      
      // Dispara o E-mail de Edição
      const data = { codAvaria: input.row[2], fabrica: input.row[1], ref: input.row[3], qtde: input.row[5], descricao: input.row[4], motivo: input.row[7], responsavel: input.row[8] };
      sendAvariaNotification('EDITADA', data);
      
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