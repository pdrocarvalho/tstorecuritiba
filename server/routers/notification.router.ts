/**
 * server/routers/notification.router.ts
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import {
  fetchLiveGoogleSheet,
  addRowToSheet,
  updateSheetRow,
  updateFullRow,
  deleteSheetRow
} from "../engines/sync.engine";
import { rodarAutomacaoLogistica } from "../engines/notification.engine";

export const notificationsRouter = router({

  rodarAutomacaoDemandas: protectedProcedure
    .input(z.object({
      urlRecebimento: z.string(),
      urlDemandas: z.string()
    }))
    .mutation(async ({ input }) => {
      return await rodarAutomacaoLogistica(input.urlRecebimento, input.urlDemandas);
    }),

  getLiveData: protectedProcedure
    .input(z.object({
      url: z.string(),
      mode: z.enum(["recebimento", "avarias", "demandas"]).optional().default("recebimento")
    }))
    .query(async ({ input }) => {
      return await fetchLiveGoogleSheet(input.url, input.mode);
    }),

  saveDemanda: protectedProcedure
    .input(z.object({ url: z.string(), aba: z.string(), dados: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      return await addRowToSheet(input.url, input.dados, input.aba);
    }),

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

  // Validação de acesso feita no backend via adminProcedure
  editAvariaFull: adminProcedure
    .input(z.object({ url: z.string(), rowNumber: z.number(), row: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      return await updateFullRow(input.url, input.rowNumber, input.row);
    }),

  deleteAvariaRow: adminProcedure
    .input(z.object({ url: z.string(), rowNumber: z.number() }))
    .mutation(async ({ input }) => {
      return await deleteSheetRow(input.url, input.rowNumber);
    }),
});