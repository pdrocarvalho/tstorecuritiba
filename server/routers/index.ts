import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { notificationRouter } from "./notification.router";
import { syncPedidosFromGoogleSheets } from "../engines/sync.engine";
import { getGoogleSheetsConfig, saveGoogleSheetsConfig } from "../db";

export const appRouter = router({
  notifications: notificationRouter,

  admin: router({
    getConfig: publicProcedure.query(async () => {
      const config = await getGoogleSheetsConfig();
      return config;
    }),
    
    configSheets: publicProcedure
      .input(z.object({ sheetsUrl: z.string() }))
      .mutation(async ({ input }) => {
        try {
          await saveGoogleSheetsConfig(input.sheetsUrl, 1);
          return { success: true, url: input.sheetsUrl };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro no BD: ${error.message}`
          });
        }
      }),
      
    syncNow: publicProcedure.mutation(async () => {
      try {
        const config = await getGoogleSheetsConfig();
        if (!config || !config.sheetsUrl) {
          throw new Error("Planilha não configurada. Salve a URL em Configurações.");
        }
        
        const resultado = await syncPedidosFromGoogleSheets(config.sheetsUrl);
        
        if (resultado.erros.length > 0) {
          console.error("Avisos na sincronização:", resultado.erros);
        }
        
        return {
          novosPedidos: resultado.novosPedidos,
          novasPrevisoes: resultado.novasPrevisoes,
          chegadas: resultado.chegadas
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro na sincronização: ${error.message}`
        });
      }
    }),
  }),

  auth: router({
    logout: publicProcedure.mutation(async () => {
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;