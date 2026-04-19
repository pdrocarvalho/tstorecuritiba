/**
 * server/routers/notification.router.ts
 */

import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { 
  fetchLiveGoogleSheet, 
  addRowToSheet, 
  updateSheetRow 
} from "../engines/sync.engine";

const t = initTRPC.create();

export const notificationsRouter = t.router({
  /**
   * 🚀 A MÁGICA: getLiveData agora aceita o "mode"
   * Isso permite que o robô saiba se deve ler o formato de Recebimento ou Avarias
   */
  getLiveData: t.procedure
    .input(
      z.object({
        url: z.string(),
        // Define que o modo só pode ser um destes dois
        mode: z.enum(["recebimento", "avarias"]).optional().default("recebimento"),
      })
    )
    .query(async ({ input }) => {
      // Passamos a URL e o Modo para o Robô no sync.engine.ts
      return await fetchLiveGoogleSheet(input.url, input.mode);
    }),

  /**
   * Adiciona uma nova linha de Avaria no Sheets
   */
  addAvaria: t.procedure
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
   * Atualiza uma célula específica (ex: mudar Status ou Tratativa)
   */
  updateAvaria: t.procedure
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

export type NotificationsRouter = typeof notificationsRouter;