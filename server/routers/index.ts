/**
 * server/routers/index.ts
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { notificationsRouter } from "./notification.router";
import {
  syncPedidosFromGoogleSheets,
  testarLeituraRobo
} from "../engines/sync.engine";
import { getGoogleSheetsConfig, saveGoogleSheetsConfig } from "../db";

export const appRouter = router({
  notifications: notificationsRouter,

  admin: router({
    getConfig: protectedProcedure.query(async () => {
      return await getGoogleSheetsConfig();
    }),

    configSheets: protectedProcedure
      .input(z.object({ sheetsUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await saveGoogleSheetsConfig(input.sheetsUrl, 1);
          return { success: true, url: input.sheetsUrl };
        } catch (error: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro no BD: ${error.message}` });
        }
      }),

    syncNow: protectedProcedure.mutation(async () => {
      try {
        const config = await getGoogleSheetsConfig();
        if (!config || !config.sheetsUrl) throw new Error("Planilha não configurada.");

        const resultado = await syncPedidosFromGoogleSheets(config.sheetsUrl);

        return {
          novosPedidos: resultado.novosPedidos,
          novasPrevisoes: resultado.novasPrevisoes,
          chegadas: resultado.chegadas,
          erros: resultado.erros
        };
      } catch (error: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro na sincronização: ${error.message}` });
      }
    }),

    testarRobo: protectedProcedure.mutation(async () => {
      try {
        const config = await getGoogleSheetsConfig();
        if (!config || !config.sheetsUrl) throw new Error("Planilha não configurada.");
        return await testarLeituraRobo(config.sheetsUrl);
      } catch (error: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro no teste: ${error.message}` });
      }
    }),
  }),

  // logout permanece público — não exige token para deslogar
  auth: router({
    logout: publicProcedure.mutation(async () => {
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;