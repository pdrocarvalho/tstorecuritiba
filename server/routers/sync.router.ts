import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../_core/trpc";
import { getRegistry } from "../agents";

export const syncRouter = router({
  runFullSync: adminProcedure
    .input(z.object({
      recebimentos: z.string().optional(),
      demandas: z.string().optional(),
      avarias: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const registry = getRegistry();
        const result = await registry.executeAgent("data-sync", {
          ...input,
          mode: "full",
        }, "user:trpc");

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Erro desconhecido ao sincronizar",
          });
        }
        return { success: true, logs: result.logs };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro interno ao rodar a sincronização",
        });
      }
    }),
});
