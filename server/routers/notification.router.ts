/**
 * server/routers/notification.router.ts
 */

import { z } from "zod";
// 🚀 IMPORTANTE: Usamos o router e publicProcedure do seu núcleo
import { router, publicProcedure } from "../_core/trpc"; 
import { 
  fetchLiveGoogleSheet, 
  addRowToSheet, 
  updateSheetRow 
} from "../engines/sync.engine";

// 🚀 NOME PADRONIZADO: notificationsRouter (plural)
export const notificationsRouter = router({
  /**
   * 🚀 getLiveData agora aceita o "mode"
   */
  getLiveData: publicProcedure
    .input(
      z.object({
        url: z.string(),
        mode: z.enum(["recebimento", "avarias"]).optional().default("recebimento"),
      })
    )
    .query(async ({ input }) => {
      return await fetchLiveGoogleSheet(input.url, input.mode);
    }),

  /**
   * Adiciona uma nova linha de Avaria
   */
  addAvaria: publicProcedure
    .input(
      z.object({
        url: z.string(),
        row: z.array(z.any()),
      })
    )
    .mutation(async ({ input }) => {
      return await addRowToSheet(input.url, input.row);
    }),

  /**
   * Atualiza uma célula específica
   */
  updateAvaria: publicProcedure
    .input(
      z.object({
        url: z.string(),
        rowNumber: z.number(),
        columnLetter: z.string(),
        newValue: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return await updateSheetRow(
        input.url, 
        input.rowNumber, 
        input.columnLetter, 
        input.newValue
      );
    }),
});