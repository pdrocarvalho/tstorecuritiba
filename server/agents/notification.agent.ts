/**
 * server/agents/notification.agent.ts
 *
 * Agente especializado em comunicação e notificações.
 * Compõe e envia e-mails e webhooks para consultores e admins.
 *
 * Domínio: Comunicação
 * Escuta: logistics:status_changed, logistics:conflict_detected,
 *         analytics:anomaly_detected, task:escalation_needed
 * Emite: notification:send_requested, notification:sent
 */

import { BaseAgent, AgentContext, AgentResult, HealthStatus } from "./_framework";
import { env } from "../_core/env";

interface NotificationPayload {
  to: string;
  subject: string;
  body: string;
  priority: "low" | "normal" | "high";
  channel: "email" | "webhook" | "both";
}

export class NotificationAgent extends BaseAgent {
  readonly name = "notification";
  readonly domain = "comunicacao";
  readonly version = "1.0.0";

  private pendingNotifications: NotificationPayload[] = [];
  private webhookUrl: string | undefined;

  // ─── CICLO DE VIDA ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    this.webhookUrl = env.APPS_SCRIPT_WEBHOOK_URL;

    // Subscreve nos eventos que geram notificações
    this.on("logistics:status_changed", async (payload, meta) => {
      this.log("info", `Status logístico mudou: ${payload.ref} (${payload.from} → ${payload.to})`);

      this.pendingNotifications.push({
        to: "admin",
        subject: `[Logística] Mudança de Status — ${payload.ref}`,
        body: `A referência ${payload.ref} mudou de ${payload.from} para ${payload.to} (aba: ${payload.demandaAba}, linha: ${payload.rowNumber}).`,
        priority: "normal",
        channel: "webhook",
      });
    });

    this.on("logistics:conflict_detected", async (payload, meta) => {
      this.log("warn", `Conflito logístico: ${payload.ref} — ${payload.demandasCount} demandas, ${payload.ofertaDisponivel} disponível`);

      this.pendingNotifications.push({
        to: "admin",
        subject: `⚠️ [Conflito] Oferta insuficiente — ${payload.ref}`,
        body: `A referência ${payload.ref} tem ${payload.demandasCount} demandas mas apenas ${payload.ofertaDisponivel} unidade(s) disponível(is). Tipo: ${payload.tipo}.`,
        priority: "high",
        channel: "both",
      });
    });

    this.on("analytics:anomaly_detected", async (payload, meta) => {
      this.log("warn", `Anomalia detectada: [${payload.severity}] ${payload.type} — ${payload.description}`);

      const priorityMap = { info: "low", warning: "normal", critical: "high" } as const;

      this.pendingNotifications.push({
        to: "admin",
        subject: `🧠 [Analytics] ${payload.type} — ${payload.severity.toUpperCase()}`,
        body: payload.description,
        priority: priorityMap[payload.severity],
        channel: payload.severity === "critical" ? "both" : "webhook",
      });
    });

    this.on("task:escalation_needed", async (payload, meta) => {
      this.log("warn", `Escalação de tarefa: #${payload.taskId} — ${payload.reason}`);

      this.pendingNotifications.push({
        to: `user:${payload.assignedTo}`,
        subject: `🔴 [Tarefa Atrasada] ${payload.reason}`,
        body: `A tarefa #${payload.taskId} está ${payload.daysOverdue} dia(s) atrasada. Motivo da escalação: ${payload.reason}.`,
        priority: "high",
        channel: "both",
      });
    });

    this.on("avarias:stalled_process", async (payload, meta) => {
      this.log("warn", `Avaria paralisada: #${payload.avariaId} (SKU: ${payload.produtoSku})`);

      this.pendingNotifications.push({
        to: "admin",
        subject: `⚠️ [Qualidade] Avaria Estagnada — SKU: ${payload.produtoSku}`,
        body: `A avaria (ID: ${payload.avariaId}) do SKU ${payload.produtoSku} está com tratativa "${payload.tratativa}" há ${payload.daysStalled} dias e precisa de atenção para não travar a reposição.`,
        priority: "high",
        channel: "webhook",
      });
    });

    this.log("info", `Webhook URL: ${this.webhookUrl ? "configurado" : "NÃO configurado"}`);
  }

  // ─── EXECUÇÃO PRINCIPAL ─────────────────────────────────────────────────────

  /**
   * Processa e envia todas as notificações pendentes.
   * Pode ser chamado manualmente ou por evento.
   */
  async execute(context: AgentContext): Promise<AgentResult> {
    const logs: string[] = [];
    const toSend = [...this.pendingNotifications];
    this.pendingNotifications = [];

    if (toSend.length === 0) {
      logs.push("Nenhuma notificação pendente para enviar.");
      return {
        success: true,
        agent: this.name,
        requestId: context.requestId,
        duration: 0,
        data: { sent: 0 },
        logs,
      };
    }

    this.log("info", `Processando ${toSend.length} notificação(ões) pendente(s)...`);

    let sent = 0;
    let failed = 0;

    for (const notification of toSend) {
      try {
        // Emite evento de requisição
        this.emit("notification:send_requested", {
          ...notification,
          timestamp: new Date(),
        }, context.requestId);

        // Envia via webhook se configurado e canal é webhook ou both
        if (this.webhookUrl && (notification.channel === "webhook" || notification.channel === "both")) {
          await this.sendWebhook(notification);
        }

        // Emite evento de confirmação
        this.emit("notification:sent", {
          to: notification.to,
          channel: notification.channel,
          success: true,
          timestamp: new Date(),
        }, context.requestId);

        sent++;
        logs.push(`✅ Enviado: [${notification.priority}] ${notification.subject}`);

      } catch (err) {
        failed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        logs.push(`❌ Falha: ${notification.subject} — ${errorMsg}`);

        this.emit("notification:sent", {
          to: notification.to,
          channel: notification.channel,
          success: false,
          timestamp: new Date(),
        }, context.requestId);
      }
    }

    return {
      success: failed === 0,
      agent: this.name,
      requestId: context.requestId,
      duration: 0,
      data: { sent, failed, total: toSend.length },
      logs,
    };
  }

  // ─── HEALTH CHECK ───────────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      agent: this.name,
      status: this.status,
      lastCheck: new Date(),
      details: {
        webhookConfigured: !!this.webhookUrl,
        pendingCount: this.pendingNotifications.length,
        stats: this.stats,
      },
    };
  }

  // ─── WEBHOOK ────────────────────────────────────────────────────────────────

  private async sendWebhook(notification: NotificationPayload): Promise<void> {
    if (!this.webhookUrl) return;

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "notification",
        to: notification.to,
        subject: notification.subject,
        body: notification.body,
        priority: notification.priority,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook respondeu com status ${response.status}`);
    }
  }

  // ─── API PÚBLICA ────────────────────────────────────────────────────────────

  /**
   * Adiciona uma notificação à fila de pendentes (para uso externo).
   */
  enqueue(notification: NotificationPayload): void {
    this.pendingNotifications.push(notification);
    this.log("info", `Notificação enfileirada: ${notification.subject}`);
  }

  getPendingCount(): number {
    return this.pendingNotifications.length;
  }
}
