/**
 * server/routers/notification.router.ts
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc"; 
import { 
  fetchLiveGoogleSheet, 
  addRowToSheet, 
  updateSheetRow,
  updateFullRow,
  deleteSheetRow
} from "../engines/sync.engine";

// 🔒 FUNÇÃO DE TRAVA: Valida o PIN (Senha) antes de continuar
const validateAdminPin = (pinEnviado: string) => {
  const pinServidor = process.env.MANAGER_PIN || "0000"; // Se você esquecer de colocar no Render, a senha será 0000
  if (pinEnviado !== pinServidor) {
    throw new TRPCError({ 
      code: "UNAUTHORIZED", 
      message: "Senha de gerente incorreta." 
    });
  }
};

export const notificationsRouter = router({
  
  // Lê as planilhas
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

  // Cria nova linha (Não exige senha, qualquer um pode registrar avaria)
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

  // Edita célula única (mantido por compatibilidade)
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
      return await updateSheetRow(input.url, input.rowNumber, input.columnLetter, input.newValue);
    }),

  // 🚀 NOVO: Edição completa da linha (EXIGE SENHA)
  editAvariaFull: publicProcedure
    .input(
      z.object({
        url: z.string(),
        rowNumber: z.number(),
        row: z.array(z.any()),
        pin: z.string() // Recebe a senha do app
      })
    )
    .mutation(async ({ input }) => {
      validateAdminPin(input.pin); // Valida a trava
      return await updateFullRow(input.url, input.rowNumber, input.row);
    }),

  // 🚀 NOVO: Exclusão total da linha (EXIGE SENHA)
  deleteAvariaRow: publicProcedure
    .input(
      z.object({
        url: z.string(),
        rowNumber: z.number(),
        pin: z.string() // Recebe a senha do app
      })
    )
    .mutation(async ({ input }) => {
      validateAdminPin(input.pin); // Valida a trava
      return await deleteSheetRow(input.url, input.rowNumber);
    }),
});