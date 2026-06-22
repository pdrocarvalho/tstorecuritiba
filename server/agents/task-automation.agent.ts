/**
 * server/agents/task-automation.agent.ts
 *
 * Agente especializado em automação do sistema de tarefas.
 * Gera tarefas automáticas, detecta pendências vencidas e escala.
 *
 * Domínio: Operacional
 * Escuta: analytics:anomaly_detected
 * Emite: task:auto_created, task:escalation_needed
 */

import { BaseAgent, AgentContext, AgentResult, HealthStatus } from "./_framework";
import { getDb } from "../db";
import { tasks, taskTemplates, users } from "../../drizzle/schema";
import { eq, and, lt, sql } from "drizzle-orm";

export class TaskAutomationAgent extends BaseAgent {
  readonly name = "task-automation";
  readonly domain = "operacional";
  readonly version = "1.0.0";

  // ─── CICLO DE VIDA ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    // Escuta anomalias para criar tarefas urgentes automaticamente
    this.on("analytics:anomaly_detected", async (payload, meta) => {
      if (payload.severity === "critical") {
        this.log("warn", `Anomalia crítica detectada: ${payload.type}. Criando tarefa urgente...`);

        try {
          await this.createUrgentTask(
            `⚠️ Investigar: ${payload.type}`,
            payload.description,
            payload.relatedRefs
          );
        } catch (err) {
          this.log("error", `Falha ao criar tarefa urgente: ${err instanceof Error ? err.message : err}`);
        }
      }
    });

    this.log("info", "Subscribed a analytics:anomaly_detected para criação automática de tarefas.");
  }

  // ─── EXECUÇÃO PRINCIPAL ─────────────────────────────────────────────────────

  async execute(context: AgentContext): Promise<AgentResult> {
    const logs: string[] = [];
    const action = (context.params.action as string) || "check_overdue";

    try {
      if (action === "check_overdue") {
        const escalations = await this.checkOverdueTasks();
        logs.push(`${escalations} tarefa(s) escalada(s) por atraso.`);

        return {
          success: true,
          agent: this.name,
          requestId: context.requestId,
          duration: 0,
          data: { escalations },
          logs,
        };

      } else if (action === "create_urgent") {
        const titulo = context.params.titulo as string;
        const descricao = context.params.descricao as string;

        if (!titulo) throw new Error("Título da tarefa é obrigatório.");

        const taskId = await this.createUrgentTask(titulo, descricao || "");
        logs.push(`Tarefa urgente #${taskId} criada.`);

        return {
          success: true,
          agent: this.name,
          requestId: context.requestId,
          duration: 0,
          data: { taskId },
          logs,
        };

      } else {
        throw new Error(`Ação desconhecida: ${action}`);
      }

    } catch (error) {
      throw error;
    }
  }

  // ─── TAREFAS URGENTES ───────────────────────────────────────────────────────

  private async createUrgentTask(
    titulo: string,
    descricao: string,
    relatedRefs?: string[]
  ): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados não disponível.");

    const today = new Date().toISOString().slice(0, 10);
    const fullDescricao = relatedRefs
      ? `${descricao}\n\nReferências relacionadas: ${relatedRefs.join(", ")}`
      : descricao;

    // Busca o primeiro admin para atribuir
    const admins = await db
      .select()
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);

    const adminId = admins.length > 0 ? admins[0].id : null;

    const result = await db.insert(tasks).values({
      titulo,
      descricao: fullDescricao,
      categoria: "geral",
      prioridade: "alta",
      dataReferencia: today,
      status: "pendente",
      atribuidoPara: adminId,
      condicional: false,
    }).returning({ id: tasks.id });

    const taskId = result[0]?.id || 0;

    this.emit("task:auto_created", {
      taskId,
      titulo,
      reason: "Criado automaticamente pelo TaskAutomationAgent",
      timestamp: new Date(),
    });

    this.log("info", `Tarefa urgente criada: #${taskId} — ${titulo}`);
    return taskId;
  }

  // ─── VERIFICAÇÃO DE TAREFAS VENCIDAS ────────────────────────────────────────

  private async checkOverdueTasks(): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados não disponível.");

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Busca tarefas pendentes com prazo expirado
    const overdueTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "pendente"),
          lt(tasks.prazo, now)
        )
      );

    let escalationCount = 0;

    for (const task of overdueTasks) {
      if (!task.prazo || !task.atribuidoPara) continue;

      const daysOverdue = Math.floor(
        (now.getTime() - new Date(task.prazo).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Escala se atrasou mais de 1 dia
      if (daysOverdue >= 1) {
        this.emit("task:escalation_needed", {
          taskId: task.id,
          reason: `Tarefa "${task.titulo}" está ${daysOverdue} dia(s) atrasada`,
          assignedTo: task.atribuidoPara,
          daysOverdue,
          timestamp: new Date(),
        });

        escalationCount++;
        this.log("warn", `Escalação: Tarefa #${task.id} ("${task.titulo}") — ${daysOverdue} dia(s) de atraso`);
      }
    }

    return escalationCount;
  }

  // ─── HEALTH CHECK ───────────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthStatus> {
    try {
      const db = await getDb();
      return {
        healthy: !!db,
        agent: this.name,
        status: this.status,
        lastCheck: new Date(),
        details: {
          databaseConnected: !!db,
          stats: this.stats,
        },
      };
    } catch (err) {
      return {
        healthy: false,
        agent: this.name,
        status: this.status,
        lastCheck: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
