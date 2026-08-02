/**
 * server/routers/notification.router.ts
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { env } from "../_core/env";
import {
  fetchLiveGoogleSheet,
  addRowToSheet,
  updateSheetRow,
  updateFullRow,
  deleteSheetRow
} from "../engines/sync.engine";
import { rodarAutomacaoLogistica, aplicarResolucaoConflito } from "../engines/notification.engine";
import { getDb } from "../db";
import { avariaHistorico, users } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const SheetRowDTO = z.array(z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]));

// Índices das colunas de controle na planilha (base 0)
const COL_TRATATIVA = 11; // Coluna L
const COL_STATUS    = 16; // Coluna Q

export const notificationsRouter = router({

  rodarAutomacaoDemandas: protectedProcedure
    .input(z.object({
      urlRecebimento: z.string().url(),
      urlDemandas: z.string().url()
    }))
    .mutation(async ({ input }) => {
      return await rodarAutomacaoLogistica(input.urlRecebimento, input.urlDemandas);
    }),

  resolverConflitosLogistica: protectedProcedure
    .input(z.object({
      urlDemandas: z.string().url(),
      resolucoes: z.array(z.object({
        aba: z.string(),
        rowNumber: z.number(),
        newStatus: z.string(),
        payloadWebhook: z.any().optional()
      }))
    }))
    .mutation(async ({ input }) => {
      return await aplicarResolucaoConflito(input.urlDemandas, input.resolucoes);
    }),

  getLiveData: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      mode: z.enum(["recebimento", "avarias", "demandas"]).optional().default("recebimento")
    }))
    .query(async ({ input }) => {
      return await fetchLiveGoogleSheet(input.url, input.mode);
    }),

  saveDemanda: protectedProcedure
    .input(z.object({ url: z.string().url(), aba: z.string(), dados: SheetRowDTO }))
    .mutation(async ({ input }) => {
      return await addRowToSheet(input.url, input.dados, input.aba);
    }),

  addAvaria: protectedProcedure
    .input(z.object({ url: z.string().url(), row: SheetRowDTO }))
    .mutation(async ({ input }) => {
      return await addRowToSheet(input.url, input.row);
    }),

  updateAvaria: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      rowNumber: z.number().int().positive(),
      columnLetter: z.string().regex(/^[A-Z]+$/),
      newValue: z.string(),
      // Campos opcionais para auto-log
      avariaId: z.number().int().positive().optional(),
      valorAnterior: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await updateSheetRow(input.url, input.rowNumber, input.columnLetter, input.newValue);

      // Auto-log: detecta mudança de tratativa (col L = índice 11) ou status (col Q = índice 16)
      if (input.avariaId && input.valorAnterior !== undefined && input.valorAnterior !== input.newValue) {
        const colIndex = input.columnLetter.charCodeAt(0) - 65;
        const isTratativa = colIndex === COL_TRATATIVA;
        const isStatus = colIndex === COL_STATUS;

        if (isTratativa || isStatus) {
          const db = await getDb();
          if (db) {
            const [dbUser] = await db.select().from(users).where(eq(users.id, ctx.user.sub)).limit(1);
            const tipo = isTratativa ? "tratativa_change" : "status_change";
            const campo = isTratativa ? "TRATATIVA" : "STATUS";
            await db.insert(avariaHistorico).values({
              avariaId: input.avariaId,
              autorId: dbUser?.id ?? null,
              autorNome: dbUser?.name ?? dbUser?.email ?? ctx.user.email ?? "Sistema",
              tipo,
              conteudo: `${campo} alterado: "${input.valorAnterior}" → "${input.newValue}"`,
            });
          }
        }
      }

      return result;
    }),

  // Validação de acesso feita no backend via adminProcedure
  editAvariaFull: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      rowNumber: z.number().int().positive(),
      row: SheetRowDTO,
      password: z.string(),
      // Campos opcionais para auto-log
      avariaId: z.number().int().positive().optional(),
      tratativaAnterior: z.string().optional(),
      statusAnterior: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.password !== env.AVARIA_EDIT_PASSWORD) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Senha de autorização incorreta.",
        });
      }
      const result = await updateFullRow(input.url, input.rowNumber, input.row);

      // Auto-log: detecta mudanças de tratativa e/ou status
      if (input.avariaId) {
        const db = await getDb();
        if (db) {
          const [dbUser] = await db.select().from(users).where(eq(users.id, ctx.user.sub)).limit(1);
          const novaTratativa = String(input.row[COL_TRATATIVA] ?? "");
          const novoStatus    = String(input.row[COL_STATUS] ?? "");

          const logs: Array<{ tipo: "tratativa_change" | "status_change"; conteudo: string }> = [];

          if (input.tratativaAnterior !== undefined && input.tratativaAnterior !== novaTratativa && novaTratativa) {
            logs.push({ tipo: "tratativa_change", conteudo: `TRATATIVA alterada: "${input.tratativaAnterior}" → "${novaTratativa}"` });
          }
          if (input.statusAnterior !== undefined && input.statusAnterior !== novoStatus && novoStatus) {
            logs.push({ tipo: "status_change", conteudo: `STATUS alterado: "${input.statusAnterior}" → "${novoStatus}"` });
          }

          for (const log of logs) {
            await db.insert(avariaHistorico).values({
              avariaId: input.avariaId,
              autorId: dbUser?.id ?? null,
              autorNome: dbUser?.name ?? dbUser?.email ?? ctx.user.email ?? "Sistema",
              ...log,
            });
          }
        }
      }

      return result;
    }),

  deleteAvariaRow: protectedProcedure
    .input(z.object({ 
      url: z.string().url(), 
      rowNumber: z.number().int().positive(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      if (input.password !== env.AVARIA_EDIT_PASSWORD) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Senha de autorização incorreta.",
        });
      }
      return await deleteSheetRow(input.url, input.rowNumber);
    }),

  // ─── HISTÓRICO DE OBSERVAÇÕES ────────────────────────────────────────────────

  getAvariaHistorico: protectedProcedure
    .input(z.object({ avariaId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(avariaHistorico)
        .where(eq(avariaHistorico.avariaId, input.avariaId))
        .orderBy(desc(avariaHistorico.createdAt));
    }),

  addAvariaObservacao: protectedProcedure
    .input(z.object({
      avariaId: z.number().int().positive(),
      conteudo: z.string().min(1, "Observação não pode ser vazia.").max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      const [dbUser] = await db.select().from(users).where(eq(users.id, ctx.user.sub)).limit(1);
      const [entrada] = await db.insert(avariaHistorico).values({
        avariaId: input.avariaId,
        autorId: dbUser?.id ?? null,
        autorNome: dbUser?.name ?? dbUser?.email ?? ctx.user.email ?? "Usuário",
        tipo: "manual",
        conteudo: input.conteudo,
      }).returning();

      return entrada;
    }),

  getAvariaBySheetId: protectedProcedure
    .input(z.object({ sheetId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const { avarias } = await import("../../drizzle/schema");
      const result = await db
        .select({ id: avarias.id })
        .from(avarias)
        .where(eq(avarias.sheetId, input.sheetId))
        .limit(1);
      return result[0] ?? null;
    }),
});
