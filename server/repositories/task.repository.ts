/**
 * server/repositories/task.repository.ts
 * Repositório de acesso ao banco para o sistema de tarefas
 */
import { eq, and, desc, asc } from "drizzle-orm";
import { requireDb } from "../db";
import {
  taskTemplates,
  tasks,
  users,
  InsertTaskTemplate,
  InsertTask,
} from "../../drizzle/schema";

// ─── TEMPLATES ──────────────────────────────────────────────────────────────

export async function getActiveTemplates() {
  const db = await requireDb("tasks:getActiveTemplates");
  return db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.ativo, true))
    .orderBy(asc(taskTemplates.ordem));
}

export async function getAllTemplates() {
  const db = await requireDb("tasks:getAllTemplates");
  return db
    .select()
    .from(taskTemplates)
    .orderBy(asc(taskTemplates.categoria), asc(taskTemplates.ordem));
}

export async function createTemplate(data: Omit<InsertTaskTemplate, "id" | "createdAt">) {
  const db = await requireDb("tasks:createTemplate");
  const [template] = await db.insert(taskTemplates).values(data).returning();
  return template;
}

export async function updateTemplate(id: number, data: Partial<InsertTaskTemplate>) {
  const db = await requireDb("tasks:updateTemplate");
  const [template] = await db
    .update(taskTemplates)
    .set(data)
    .where(eq(taskTemplates.id, id))
    .returning();
  return template;
}

export async function deleteTemplate(id: number) {
  // Soft delete: apenas desativa
  return updateTemplate(id, { ativo: false });
}

// ─── TASKS (INSTÂNCIAS) ─────────────────────────────────────────────────────

export async function getTasksByDate(dataReferencia: string) {
  const db = await requireDb("tasks:getTasksByDate");
  return db
    .select({
      task: tasks,
      atribuidoNome: users.name,
      concluidoNome: users.name, // We can reuse users for concluidoPor if needed, but let's just fetch tasks
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.concluidoPor, users.id))
    .where(eq(tasks.dataReferencia, dataReferencia))
    .orderBy(asc(tasks.categoria), asc(tasks.id));
}

export async function getTasksByDateRange(
  startDate: string,
  endDate: string,
  userId?: number
) {
  const db = await requireDb("tasks:getTasksByDateRange");
  const { sql } = await import("drizzle-orm");

  const conditions: ReturnType<typeof eq>[] = [];
  conditions.push(sql`${tasks.dataReferencia} >= ${startDate}` as unknown as ReturnType<typeof eq>);
  conditions.push(sql`${tasks.dataReferencia} <= ${endDate}` as unknown as ReturnType<typeof eq>);

  if (userId) {
    conditions.push(eq(tasks.concluidoPor, userId)); // Filter by who completed it instead of assigned
  }

  return db
    .select({
      task: tasks,
      atribuidoNome: users.name, // Aliased for concluidoNome
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.concluidoPor, users.id))
    .where(and(...conditions))
    .orderBy(desc(tasks.dataReferencia), asc(tasks.categoria), asc(tasks.id));
}

export async function completeTask(
  taskId: number,
  userId: number,
  comentario?: string
) {
  const db = await requireDb("tasks:completeTask");
  const [updated] = await db
    .update(tasks)
    .set({
      status: "concluida",
      concluidoEm: new Date(),
      concluidoPor: userId,
      comentario: comentario || null,
    })
    .where(eq(tasks.id, taskId))
    .returning();
  return updated;
}

export async function markTaskNotApplicable(taskId: number, userId: number) {
  const db = await requireDb("tasks:markNotApplicable");
  const [updated] = await db
    .update(tasks)
    .set({
      status: "nao_aplicavel",
      concluidoEm: new Date(),
      concluidoPor: userId,
    })
    .where(eq(tasks.id, taskId))
    .returning();
  return updated;
}

export async function createAdHocTask(data: Omit<InsertTask, "id" | "createdAt">) {
  const db = await requireDb("tasks:createAdHocTask");
  const [task] = await db.insert(tasks).values(data).returning();
  return task;
}

/**
 * Gera UM checklist ÚNICO da loja para o dia.
 */
export async function generateDailyTasks(dataReferencia: string) {
  const db = await requireDb("tasks:generateDailyTasks");
  
  const existing = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.dataReferencia, dataReferencia))
    .limit(1);

  if (existing.length > 0) {
    return getTasksByDate(dataReferencia);
  }

  const templates = await getActiveTemplates();
  const date = new Date(dataReferencia + "T12:00:00");
  const diaSemana = date.getDay();

  const tasksToInsert: Omit<InsertTask, "id" | "createdAt">[] = [];

  for (const template of templates) {
    if (template.diasSemana) {
      const dias: number[] = JSON.parse(template.diasSemana);
      if (!dias.includes(diaSemana)) continue;
    }

    tasksToInsert.push({
      templateId: template.id,
      titulo: template.titulo,
      descricao: template.descricao,
      categoria: template.categoria,
      dataReferencia,
      atribuidoPara: null, // Checklist compartilhado, sem dono inicial
      status: "pendente",
      condicional: template.condicional,
      condicaoTexto: template.condicaoTexto,
    });
  }

  if (tasksToInsert.length > 0) {
    await db.insert(tasks).values(tasksToInsert);
  }

  return getTasksByDate(dataReferencia);
}

/**
 * Busca todos os user IDs com role "user" (consultores)
 */
export async function getConsultorUserIds(): Promise<number[]> {
  const db = await requireDb("tasks:getConsultorUserIds");
  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "user"));
  return result.map((r) => r.id);
}
