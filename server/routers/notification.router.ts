import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { 
  fetchLiveGoogleSheet, 
  addRowToSheet, 
  updateSheetRow 
} from "../engines/sync.engine";

export const notificationRouter = router({
  // 1. LER DADOS
  getLiveData: publicProcedure
    .input(z.object({ url: z.string() }))
    .query(async ({ input }) => {
      if (!input.url) return [];
      return fetchLiveGoogleSheet(input.url);
    }),

  // 2. ADICIONAR (CREATE)
  addAvaria: publicProcedure
    .input(z.object({ url: z.string(), row: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      return await addRowToSheet(input.url, input.row);
    }),

  // 3. EDITAR STATUS (UPDATE)
  // Nota: Na sua planilha, o STATUS é a coluna M (13ª coluna).
  updateAvariaStatus: publicProcedure
    .input(z.object({ 
      url: z.string(), 
      rowNumber: z.number(), 
      status: z.string() 
    }))
    .mutation(async ({ input }) => {
      // "M" é a letra da coluna STATUS na sua estrutura
      return await updateSheetRow(input.url, input.rowNumber, "M", input.status);
    }),
});