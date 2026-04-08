/**
 * server/routers/index.ts
 */
import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { notificationRouter } from "./notification.router";

export const appRouter = router({
  // Rota de notificações que já tínhamos
  notifications: notificationRouter,

  // Rota de Administração (Sincronização e Configurações)
  admin: router({
    getConfig: publicProcedure.query(async () => {
      return null;
    }),
    configSheets: publicProcedure
      .input(z.object({ sheetsUrl: z.string() }))
      .mutation(async ({ input }) => {
        return { success: true, url: input.sheetsUrl };
      }),
    syncNow: publicProcedure.mutation(async () => {
      return { novosPedidos: 0, novasPrevisoes: 0, chegadas: 0 };
    }),
  }),

  // Rota de Autenticação (Para o botão de Logout na Sidebar funcionar)
  auth: router({
    logout: publicProcedure.mutation(async () => {
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;