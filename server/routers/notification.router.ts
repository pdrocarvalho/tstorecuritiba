/**
 * server/routers/notification.router.ts
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  fetchLiveGoogleSheet,
  addRowToSheet,
  updateSheetRow,
  updateFullRow,
  deleteSheetRow
} from "../engines/sync.engine";
import { rodarAutomacaoLogistica } from "../engines/notification.engine";

const validateAdminPin = (pinEnviado: string) => {
  const pinServidor = process.env.MANAGER_PIN || "0000";
  if (pinEnviado !== pinServidor) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha de gerente incorreta." });
  }
};

export const notificationsRouter = router({

  // Rodar automação de demandas (Alerta e Venda Futura)
  rodarAutomacaoDemandas: protectedProcedure
    .input(z.object({
      urlRecebimento: z.string(),
      urlDemandas: z.string()
    }))
    .mutation(async ({ input }) => {
      return await rodarAutomacaoLogistica(input.urlRecebimento, input.urlDemandas);
    }),

  // Buscar dados em tempo real
  getLiveData: protectedProcedure
    .input(z.object({
      url: z.string(),
      mode: z.enum(["recebimento", "avarias", "demandas"]).optional().default("recebimento")
    }))
    .query(async ({ input }) => {
      return await fetchLiveGoogleSheet(input.url, input.mode);
    }),

  // Salvar nova demanda
  saveDemanda: protectedProcedure
    .input(z.object({ url: z.string(), aba: z.string(), dados: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      return await addRowToSheet(input.url, input.dados, input.aba);
    }),

  // Gestão de avarias
  addAvaria: protectedProcedure
    .input(z.object({ url: z.string(), row: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      return await addRowToSheet(input.url, input.row);
    }),

  updateAvaria: protectedProcedure
    .input(z.object({ url: z.string(), rowNumber: z.number(), columnLetter: z.string(), newValue: z.string() }))
    .mutation(async ({ input }) => {
      return await updateSheetRow(input.url, input.rowNumber, input.columnLetter, input.newValue);
    }),

  editAvariaFull: protectedProcedure
    .input(z.object({ url: z.string(), rowNumber: z.number(), row: z.array(z.any()), pin: z.string() }))
    .mutation(async ({ input }) => {
      validateAdminPin(input.pin);
      return await updateFullRow(input.url, input.rowNumber, input.row);
    }),

  deleteAvariaRow: protectedProcedure
    .input(z.object({ url: z.string(), rowNumber: z.number(), pin: z.string() }))
    .mutation(async ({ input }) => {
      validateAdminPin(input.pin);
      return await deleteSheetRow(input.url, input.rowNumber);
    }),
});