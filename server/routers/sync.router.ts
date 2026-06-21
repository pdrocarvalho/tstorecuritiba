import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../_core/trpc";
import { DataSyncAgent } from "../agents/data-sync.agent";

export const syncRouter = router({
  runFullSync: adminProcedure
    .input(z.object({
      recebimentos: z.string().optional(),
      demandas: z.string().optional(),
      avarias: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await DataSyncAgent.runFullSync(input);
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Erro desconhecido ao sincronizar",
          });
        }
        return { success: true, logs: result.logs };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erro interno ao rodar a sincronização",
        });
      }
    }),
});
