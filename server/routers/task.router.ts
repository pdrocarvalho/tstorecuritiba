/**
 * server/routers/task.router.ts
 * Router TRPC para o sistema de gestão de tarefas
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import {
  getActiveTemplates,
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTasksByDate,
  getTasksByDateRange,
  completeTask,
  markTaskNotApplicable,
  createAdHocTask,
  generateDailyTasks,
  getConsultorUserIds,
} from "../repositories/task.repository";

const TaskCategoryEnum = z.enum(["abertura", "fechamento", "estoque", "geral"]);
const TaskPriorityEnum = z.enum(["alta", "media", "baixa"]);
const TaskTargetProfileEnum = z.enum(["consultor", "adm", "todos"]);

export const taskRouter = router({
  // ─── CONSULTOR ──────────────────────────────────────────────────────────────

  /** Busca as tarefas do dia do usuário logado (lazy generation) */
  getMyTasks: protectedProcedure
    .input(z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.sub;

      // Lazy generation: se não houver tarefas para o dia, gera automaticamente
      const existing = await getTasksByDate(input.data, userId);
      if (existing.length === 0) {
        const consultorIds = await getConsultorUserIds();
        await generateDailyTasks(input.data, consultorIds);
        return getTasksByDate(input.data, userId);
      }

      return existing;
    }),

  /** Marca uma tarefa como concluída com comentário opcional */
  completeTask: protectedProcedure
    .input(z.object({
      taskId: z.number().int().positive(),
      comentario: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return completeTask(input.taskId, ctx.user.sub, input.comentario);
    }),

  /** Marca uma tarefa condicional como "não aplicável" */
  markNotApplicable: protectedProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return markTaskNotApplicable(input.taskId, ctx.user.sub);
    }),

  // ─── ADMIN ────────────────────────────────────────────────────────────────

  /** Lista todas as tarefas com filtros (visão Admin) */
  getAllTasks: adminProcedure
    .input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      userId: z.number().int().positive().optional(),
    }))
    .query(async ({ input }) => {
      return getTasksByDateRange(input.startDate, input.endDate, input.userId);
    }),

  /** Lista todos os templates para gerenciamento */
  getTemplates: adminProcedure
    .query(async () => {
      return getAllTemplates();
    }),

  /** Cria novo template de tarefa recorrente */
  createTemplate: adminProcedure
    .input(z.object({
      titulo: z.string().min(1),
      descricao: z.string().optional(),
      categoria: TaskCategoryEnum,
      perfilAlvo: TaskTargetProfileEnum.default("consultor"),
      diasSemana: z.string().optional(), // JSON: "[1,3,5]"
      condicional: z.boolean().default(false),
      condicaoTexto: z.string().optional(),
      ordem: z.number().int().default(0),
    }))
    .mutation(async ({ input }) => {
      return createTemplate(input);
    }),

  /** Edita um template existente */
  updateTemplate: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      titulo: z.string().min(1).optional(),
      descricao: z.string().optional(),
      categoria: TaskCategoryEnum.optional(),
      perfilAlvo: TaskTargetProfileEnum.optional(),
      diasSemana: z.string().nullable().optional(),
      condicional: z.boolean().optional(),
      condicaoTexto: z.string().nullable().optional(),
      ordem: z.number().int().optional(),
      ativo: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updateTemplate(id, data);
    }),

  /** Desativa (soft delete) um template */
  deleteTemplate: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      return deleteTemplate(input.id);
    }),

  /** Cria tarefa avulsa/pontual atribuída a alguém */
  createAdHocTask: adminProcedure
    .input(z.object({
      titulo: z.string().min(1),
      descricao: z.string().optional(),
      categoria: TaskCategoryEnum.default("geral"),
      prioridade: TaskPriorityEnum.default("media"),
      dataReferencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      prazo: z.string().optional(), // ISO string
      atribuidoPara: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      return createAdHocTask({
        ...input,
        prazo: input.prazo ? new Date(input.prazo) : null,
        status: "pendente",
        condicional: false,
      });
    }),

  /** Força a geração manual do checklist diário */
  generateDailyTasks: adminProcedure
    .input(z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      const consultorIds = await getConsultorUserIds();
      return generateDailyTasks(input.data, consultorIds);
    }),
});
