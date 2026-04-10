import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { notificationRouter } from "./notification.router";
import { syncPedidosFromGoogleSheets } from "../engines/sync.engine";
import { getGoogleSheetsConfig, saveGoogleSheetsConfig } from "../db";

export const appRouter = router({
  notifications: notificationRouter,

  admin: router({
    // Busca a configuração guardada na DB
    getConfig: publicProcedure.query(async () => {
      const config = await getGoogleSheetsConfig();
      return config;
    }),
    
    // Salva a nova URL na DB
    configSheets: publicProcedure
      .input(z.object({ sheetsUrl: z.string() }))
      .mutation(async ({ input }) => {
        // Usa o Consultor de ID 1 como padrão (já que temos SSO, depois vinculamos ao utilizador logado)
        await saveGoogleSheetsConfig(input.sheetsUrl, 1);
        return { success: true, url: input.sheetsUrl };
      }),
      
    // Dispara a leitura com o Robô
    syncNow: publicProcedure.mutation(async () => {
      const config = await getGoogleSheetsConfig();
      if (!config || !config.sheetsUrl) {
        throw new Error("Planilha não configurada. Salve a URL em Configurações.");
      }
      
      // Aciona o motor do Google Sheets!
      const resultado = await syncPedidosFromGoogleSheets(config.sheetsUrl);
      
      if (resultado.erros.length > 0) {
        console.error("Avisos na sincronização:", resultado.erros);
      }
      
      return {
        novosPedidos: resultado.novosPedidos,
        novasPrevisoes: resultado.novasPrevisoes,
        chegadas: resultado.chegadas
      };
    }),
  }),

  auth: router({
    logout: publicProcedure.mutation(async () => {
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;