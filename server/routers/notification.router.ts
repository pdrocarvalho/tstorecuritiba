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
import { rodarAutomacaoLogistica, aplicarResolucaoConflito } from "../engines/notification.engine";

const SheetRowDTO = z.array(z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]));

export const notificationsRouter = router({

  rodarAutomacaoDemandas: protectedProcedure
    .input(z.object({
      urlRecebimento: z.string().url(),
      urlDemandas: z.string().url()
    }))
    .mutation(async ({ input }) => {
      return await rodarAutomacaoLogistica(input.urlRecebimento, input.urlDemandas);
    }),

  resolverConflitosLogistica: protectedProcedure
    .input(z.object({
      urlDemandas: z.string().url(),
      resolucoes: z.array(z.object({
        aba: z.string(),
        rowNumber: z.number(),
        newStatus: z.string(),
        payloadWebhook: z.any().optional()
      }))
    }))
    .mutation(async ({ input }) => {
      return await aplicarResolucaoConflito(input.urlDemandas, input.resolucoes);
    }),

  getLiveData: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      mode: z.enum(["recebimento", "avarias", "demandas"]).optional().default("recebimento")
    }))
    .query(async ({ input }) => {
      return await fetchLiveGoogleSheet(input.url, input.mode);
    }),

  saveDemanda: protectedProcedure
    .input(z.object({ url: z.string().url(), aba: z.string(), dados: SheetRowDTO }))
    .mutation(async ({ input }) => {
      return await addRowToSheet(input.url, input.dados, input.aba);
    }),

  addAvaria: protectedProcedure
    .input(z.object({ url: z.string().url(), row: SheetRowDTO }))
    .mutation(async ({ input }) => {
      return await addRowToSheet(input.url, input.row);
    }),

  updateAvaria: protectedProcedure
    .input(z.object({ url: z.string().url(), rowNumber: z.number().int().positive(), columnLetter: z.string().regex(/^[A-Z]+$/), newValue: z.string() }))
    .mutation(async ({ input }) => {
      return await updateSheetRow(input.url, input.rowNumber, input.columnLetter, input.newValue);
    }),

  // Validação de acesso feita no backend via adminProcedure
  editAvariaFull: adminProcedure
    .input(z.object({ url: z.string().url(), rowNumber: z.number().int().positive(), row: SheetRowDTO }))
    .mutation(async ({ input }) => {
      return await updateFullRow(input.url, input.rowNumber, input.row);
    }),

  deleteAvariaRow: adminProcedure
    .input(z.object({ url: z.string().url(), rowNumber: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      return await deleteSheetRow(input.url, input.rowNumber);
    })
});