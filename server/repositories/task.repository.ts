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

export async function getTasksByDate(dataReferencia: string, userId?: number) {
  const db = await requireDb("tasks:getTasksByDate");
  const conditions = [eq(tasks.dataReferencia, dataReferencia)];
  if (userId) {
    conditions.push(eq(tasks.atribuidoPara, userId));
  }

  return db
    .select({
      task: tasks,
      atribuidoNome: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.atribuidoPara, users.id))
    .where(and(...conditions))
    .orderBy(asc(tasks.categoria), asc(tasks.id));
}

export async function getTasksByDateRange(
  startDate: string,
  endDate: string,
  userId?: number
) {
  const db = await requireDb("tasks:getTasksByDateRange");
  // Importar sql para comparações de intervalo de data
  const { sql } = await import("drizzle-orm");

  const conditions: ReturnType<typeof eq>[] = [];
  conditions.push(sql`${tasks.dataReferencia} >= ${startDate}` as unknown as ReturnType<typeof eq>);
  conditions.push(sql`${tasks.dataReferencia} <= ${endDate}` as unknown as ReturnType<typeof eq>);

  if (userId) {
    conditions.push(eq(tasks.atribuidoPara, userId));
  }

  return db
    .select({
      task: tasks,
      atribuidoNome: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.atribuidoPara, users.id))
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
 * Gera tarefas do dia a partir dos templates ativos.
 * Verifica o dia da semana e só gera templates aplicáveis.
 * Retorna as tarefas criadas.
 */
export async function generateDailyTasks(dataReferencia: string, userIds: number[]) {
  const db = await requireDb("tasks:generateDailyTasks");
  // Verifica se já existem tarefas geradas para esse dia
  const existing = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.dataReferencia, dataReferencia),
        // Só checa tarefas de template (não avulsas)
        // templateId não é null
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Já geradas — retorna as existentes
    return getTasksByDate(dataReferencia);
  }

  const templates = await getActiveTemplates();
  const date = new Date(dataReferencia + "T12:00:00"); // Evita problemas de timezone
  const diaSemana = date.getDay(); // 0=dom, 1=seg, ..., 6=sab

  const tasksToInsert: Omit<InsertTask, "id" | "createdAt">[] = [];

  for (const template of templates) {
    // Verifica se o template se aplica ao dia da semana
    if (template.diasSemana) {
      const dias: number[] = JSON.parse(template.diasSemana);
      if (!dias.includes(diaSemana)) continue;
    }

    if (template.perfilAlvo === "consultor" || template.perfilAlvo === "todos") {
      // Gera uma instância para cada consultor
      for (const userId of userIds) {
        tasksToInsert.push({
          templateId: template.id,
          titulo: template.titulo,
          descricao: template.descricao,
          categoria: template.categoria,
          dataReferencia,
          atribuidoPara: userId,
          status: "pendente",
          condicional: template.condicional,
          condicaoTexto: template.condicaoTexto,
        });
      }
    }

    if (template.perfilAlvo === "adm" || template.perfilAlvo === "todos") {
      // Gera para admins — busca usuários admin
      const admins = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"));

      for (const admin of admins) {
        // Evita duplicar se já foi adicionado como "todos"
        if (template.perfilAlvo === "todos" && userIds.includes(admin.id)) continue;
        tasksToInsert.push({
          templateId: template.id,
          titulo: template.titulo,
          descricao: template.descricao,
          categoria: template.categoria,
          dataReferencia,
          atribuidoPara: admin.id,
          status: "pendente",
          condicional: template.condicional,
          condicaoTexto: template.condicaoTexto,
        });
      }
    }
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
