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

// Verifica se o usuário autenticado tem role de admin
const requireAdmin = (role: string) => {
  if (role !== "admin") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Apenas gerentes podem realizar esta ação.",
    });
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

  // ← pin removido do input; role verificado via JWT no contexto
  editAvariaFull: protectedProcedure
    .input(z.object({ url: z.string(), rowNumber: z.number(), row: z.array(z.any()) }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      return await updateFullRow(input.url, input.rowNumber, input.row);
    }),

  // ← pin removido do input; role verificado via JWT no contexto
  deleteAvariaRow: protectedProcedure
    .input(z.object({ url: z.string(), rowNumber: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      return await deleteSheetRow(input.url, input.rowNumber);
    }),
});