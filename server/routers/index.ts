/**
 * server/routers/index.ts
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { notificationsRouter } from "./notification.router";
import { taskRouter } from "./task.router";

import { getGoogleSheetsConfig, saveGoogleSheetsConfig } from "../repositories/config.repository";

export const appRouter = router({
  notifications: notificationsRouter,
  tasks: taskRouter,

  admin: router({
    getConfig: adminProcedure.query(async () => {
      return await getGoogleSheetsConfig();
    }),

    configSheets: adminProcedure
      .input(z.object({ sheetsUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await saveGoogleSheetsConfig(input.sheetsUrl, 1);
          return { success: true, url: input.sheetsUrl };
        } catch (error: unknown) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro no BD: ${error instanceof Error ? error.message : "Erro desconhecido"}` });
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