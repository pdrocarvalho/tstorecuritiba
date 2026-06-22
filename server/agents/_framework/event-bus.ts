/**
 * server/agents/_framework/event-bus.ts
 *
 * EventBus tipado — o sistema nervoso central de comunicação inter-agente.
 *
 * Funcionalidades:
 * - Pub/Sub com tipagem forte via AgentEventMap
 * - Suporte a wildcard listeners (ex: "sync:*" escuta sync:completed e sync:failed)
 * - Dead Letter Queue para eventos sem subscribers
 * - Métricas de uso por evento e agente
 * - Replay de eventos para debugging
 *
 * Padrão Singleton — apenas uma instância existe no processo.
 */

import { randomUUID } from "crypto";
import type {
  AgentEventKey,
  AgentEventPayload,
  AgentEventHandler,
  EventMeta,
  EventSubscription,
  EventBusMetrics,
} from "./types";

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface DeadLetterEntry {
  event: string;
  payload: unknown;
  meta: EventMeta;
  reason: string;
}

interface EventHistoryEntry {
  event: string;
  payload: unknown;
  meta: EventMeta;
}

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

export class EventBus {
  private static instance: EventBus | null = null;

  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private wildcardSubscriptions: EventSubscription[] = [];
  private deadLetterQueue: DeadLetterEntry[] = [];
  private eventHistory: EventHistoryEntry[] = [];

  // Métricas
  private totalEmitted = 0;
  private totalConsumed = 0;
  private eventCounts: Record<string, number> = {};
  private subscriberCounts: Record<string, number> = {};

  // Configuração
  private maxHistorySize = 200;
  private maxDeadLetterSize = 100;

  private constructor() {}

  /**
   * Retorna a instância singleton do EventBus.
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Reset para testes — destrói a instância singleton.
   */
  static resetInstance(): void {
    if (EventBus.instance) {
      EventBus.instance.subscriptions.clear();
      EventBus.instance.wildcardSubscriptions = [];
      EventBus.instance.deadLetterQueue = [];
      EventBus.instance.eventHistory = [];
      EventBus.instance = null;
    }
  }

  // ─── SUBSCRIBE ──────────────────────────────────────────────────────────────

  /**
   * Registra um handler para um evento específico.
   *
   * @example
   * bus.on("sync:completed", (payload, meta) => {
   *   console.log(`Sync done: ${payload.recordCount} records`);
   * }, "LogisticsAgent");
   */
  on<K extends AgentEventKey>(
    event: K,
    handler: AgentEventHandler<K>,
    agentName: string
  ): string {
    const subscription: EventSubscription = {
      id: randomUUID(),
      event,
      agentName,
      handler: handler as AgentEventHandler<any>,
      isWildcard: false,
    };

    const existing = this.subscriptions.get(event) || [];
    existing.push(subscription);
    this.subscriptions.set(event, existing);

    // Atualiza contadores
    this.subscriberCounts[event] = (this.subscriberCounts[event] || 0) + 1;

    console.log(`[EventBus] 📡 ${agentName} subscribed to "${event}"`);
    return subscription.id;
  }

  /**
   * Registra um handler para todos os eventos de um domínio.
   *
   * @example
   * bus.onWildcard("sync", handler, "AnalyticsAgent");
   * // Escuta: sync:completed, sync:failed, etc.
   */
  onWildcard(
    domainPrefix: string,
    handler: AgentEventHandler<any>,
    agentName: string
  ): string {
    const subscription: EventSubscription = {
      id: randomUUID(),
      event: `${domainPrefix}:*`,
      agentName,
      handler,
      isWildcard: true,
    };

    this.wildcardSubscriptions.push(subscription);
    console.log(`[EventBus] 📡 ${agentName} subscribed to "${domainPrefix}:*" (wildcard)`);
    return subscription.id;
  }

  /**
   * Remove uma subscrição pelo ID.
   */
  off(subscriptionId: string): boolean {
    // Procura nas subscrições diretas
    for (const [event, subs] of this.subscriptions.entries()) {
      const idx = subs.findIndex((s) => s.id === subscriptionId);
      if (idx !== -1) {
        const removed = subs.splice(idx, 1)[0];
        this.subscriberCounts[event] = Math.max(0, (this.subscriberCounts[event] || 1) - 1);
        console.log(`[EventBus] 🔕 ${removed.agentName} unsubscribed from "${event}"`);
        return true;
      }
    }

    // Procura nas wildcards
    const wcIdx = this.wildcardSubscriptions.findIndex((s) => s.id === subscriptionId);
    if (wcIdx !== -1) {
      const removed = this.wildcardSubscriptions.splice(wcIdx, 1)[0];
      console.log(`[EventBus] 🔕 ${removed.agentName} unsubscribed from "${removed.event}" (wildcard)`);
      return true;
    }

    return false;
  }

  // ─── EMIT ───────────────────────────────────────────────────────────────────

  /**
   * Emite um evento tipado para todos os subscribers.
   *
   * @example
   * bus.emit("sync:completed", {
   *   mode: "full",
   *   recordCount: 150,
   *   logs: ["..."],
   *   timestamp: new Date()
   * }, "DataSyncAgent");
   */
  async emit<K extends AgentEventKey>(
    event: K,
    payload: AgentEventPayload<K>,
    emittedBy: string,
    requestId?: string
  ): Promise<void> {
    const meta: EventMeta = {
      eventId: randomUUID(),
      emittedBy,
      emittedAt: new Date(),
      requestId,
    };

    // Métricas
    this.totalEmitted++;
    this.eventCounts[event] = (this.eventCounts[event] || 0) + 1;

    // Histórico
    this.eventHistory.push({ event, payload, meta });
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    console.log(`[EventBus] ⚡ "${event}" emitted by ${emittedBy} (id: ${meta.eventId.slice(0, 8)})`);

    // Coleta todos os handlers aplicáveis
    const directSubs = this.subscriptions.get(event) || [];
    const domainPrefix = event.split(":")[0];
    const wildcardSubs = this.wildcardSubscriptions.filter(
      (s) => s.event === `${domainPrefix}:*`
    );

    const allHandlers = [...directSubs, ...wildcardSubs];

    // Dead letter queue se ninguém escuta
    if (allHandlers.length === 0) {
      this.addToDeadLetter(event, payload, meta, "Nenhum subscriber registrado");
      return;
    }

    // Executa todos os handlers em paralelo
    const results = await Promise.allSettled(
      allHandlers.map(async (sub) => {
        try {
          await sub.handler(payload, meta);
          this.totalConsumed++;
          console.log(`[EventBus] ✅ "${event}" consumed by ${sub.agentName}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[EventBus] ❌ "${event}" handler error in ${sub.agentName}: ${errorMsg}`);
          throw err;
        }
      })
    );

    // Loga falhas
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.warn(`[EventBus] ⚠️ ${failures.length}/${allHandlers.length} handlers failed for "${event}"`);
    }
  }

  // ─── DEAD LETTER QUEUE ──────────────────────────────────────────────────────

  private addToDeadLetter(
    event: string,
    payload: unknown,
    meta: EventMeta,
    reason: string
  ): void {
    console.warn(`[EventBus] 💀 Dead Letter: "${event}" — ${reason}`);
    this.deadLetterQueue.push({ event, payload, meta, reason });
    if (this.deadLetterQueue.length > this.maxDeadLetterSize) {
      this.deadLetterQueue.shift();
    }
  }

  getDeadLetterQueue(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }

  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
  }

  // ─── REPLAY ─────────────────────────────────────────────────────────────────

  /**
   * Re-emite eventos do histórico. Útil para debugging e re-processamento.
   */
  async replay(filter?: { event?: string; after?: Date }): Promise<number> {
    let entries = [...this.eventHistory];

    if (filter?.event) {
      entries = entries.filter((e) => e.event === filter.event);
    }
    if (filter?.after) {
      entries = entries.filter((e) => e.meta.emittedAt >= filter.after!);
    }

    console.log(`[EventBus] 🔄 Replaying ${entries.length} events...`);

    for (const entry of entries) {
      await this.emit(
        entry.event as AgentEventKey,
        entry.payload as any,
        `replay:${entry.meta.emittedBy}`,
        entry.meta.requestId
      );
    }

    return entries.length;
  }

  // ─── MÉTRICAS ───────────────────────────────────────────────────────────────

  getMetrics(): EventBusMetrics {
    return {
      totalEmitted: this.totalEmitted,
      totalConsumed: this.totalConsumed,
      deadLetterCount: this.deadLetterQueue.length,
      eventCounts: { ...this.eventCounts },
      subscriberCounts: { ...this.subscriberCounts },
    };
  }

  // ─── UTILIDADES ─────────────────────────────────────────────────────────────

  getSubscriberCount(event: AgentEventKey): number {
    const direct = (this.subscriptions.get(event) || []).length;
    const domainPrefix = event.split(":")[0];
    const wildcard = this.wildcardSubscriptions.filter(
      (s) => s.event === `${domainPrefix}:*`
    ).length;
    return direct + wildcard;
  }

  getRegisteredEvents(): string[] {
    const events = new Set<string>();
    for (const key of this.subscriptions.keys()) events.add(key);
    for (const sub of this.wildcardSubscriptions) events.add(sub.event);
    return Array.from(events);
  }

  getEventHistory(): EventHistoryEntry[] {
    return [...this.eventHistory];
  }
}
