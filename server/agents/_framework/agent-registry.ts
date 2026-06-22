/**
 * server/agents/_framework/agent-registry.ts
 *
 * Orquestrador central do sistema multi-agente.
 *
 * Responsabilidades:
 * - Registro de agentes com validação de unicidade
 * - Inicialização ordenada por dependências (topological sort)
 * - Execução de agentes com contexto padronizado
 * - Health monitoring de todos os agentes
 * - Graceful shutdown
 *
 * Padrão Singleton — apenas uma instância por processo.
 */

import { randomUUID } from "crypto";
import { BaseAgent } from "./base-agent";
import { EventBus } from "./event-bus";
import type { AgentContext, AgentResult, AgentConfig, HealthReport } from "./types";

export class AgentRegistry {
  private static instance: AgentRegistry | null = null;
  private agents: Map<string, BaseAgent> = new Map();
  private initOrder: string[] = [];
  private initialized = false;

  private constructor() {}

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  static resetInstance(): void {
    AgentRegistry.instance = null;
  }

  // ─── REGISTRO ───────────────────────────────────────────────────────────────

  /**
   * Registra um agente no sistema.
   *
   * @example
   * registry.register(new DataSyncAgent(), { dependencies: [] });
   * registry.register(new LogisticsAgent(), { dependencies: ["data-sync"] });
   */
  register(agent: BaseAgent, config?: AgentConfig): void {
    if (this.agents.has(agent.name)) {
      throw new Error(`[AgentRegistry] Agente "${agent.name}" já está registrado.`);
    }

    if (config) {
      agent.configure(config);
    }

    this.agents.set(agent.name, agent);
    console.log(`[AgentRegistry] 📦 Registrado: ${agent.name} v${agent.version} (domínio: ${agent.domain})`);
  }

  /**
   * Remove um agente do registro.
   */
  unregister(name: string): boolean {
    const agent = this.agents.get(name);
    if (!agent) return false;

    agent.shutdown();
    this.agents.delete(name);
    console.log(`[AgentRegistry] 🗑️ Removido: ${name}`);
    return true;
  }

  // ─── INICIALIZAÇÃO ──────────────────────────────────────────────────────────

  /**
   * Inicializa todos os agentes registrados na ordem correta de dependências.
   * Usa topological sort para garantir que dependências são resolvidas antes.
   */
  async initializeAll(): Promise<void> {
    if (this.initialized) {
      console.warn("[AgentRegistry] ⚠️ Agentes já inicializados.");
      return;
    }

    console.log(`[AgentRegistry] 🚀 Inicializando ${this.agents.size} agentes...`);

    // Resolve ordem de dependências
    this.initOrder = this.resolveInitOrder();

    for (const name of this.initOrder) {
      const agent = this.agents.get(name);
      if (!agent) continue;

      // Skip se desabilitado
      if (agent.config.enabled === false) {
        console.log(`[AgentRegistry] ⏭️ ${name} desabilitado, pulando.`);
        continue;
      }

      try {
        await agent.boot();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[AgentRegistry] ❌ Falha ao inicializar "${name}": ${msg}`);
        // Continua com os próximos — não trava o sistema inteiro
      }
    }

    this.initialized = true;
    console.log(`[AgentRegistry] ✅ Todos os agentes inicializados.`);
  }

  /**
   * Topological sort das dependências.
   * Garante que agentes são inicializados na ordem correta.
   */
  private resolveInitOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (name: string, visiting: Set<string>) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`[AgentRegistry] Dependência circular detectada envolvendo "${name}"`);
      }

      visiting.add(name);

      const agent = this.agents.get(name);
      if (agent?.config.dependencies) {
        for (const dep of agent.config.dependencies) {
          if (!this.agents.has(dep)) {
            console.warn(`[AgentRegistry] ⚠️ Dependência "${dep}" de "${name}" não encontrada. Ignorando.`);
            continue;
          }
          visit(dep, visiting);
        }
      }

      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of this.agents.keys()) {
      visit(name, new Set());
    }

    return order;
  }

  // ─── EXECUÇÃO ───────────────────────────────────────────────────────────────

  /**
   * Executa um agente específico com contexto padronizado.
   *
   * @example
   * const result = await registry.executeAgent("data-sync", {
   *   avarias: "sheet-url-1",
   *   demandas: "sheet-url-2",
   * }, "user");
   */
  async executeAgent(
    name: string,
    params: Record<string, unknown> = {},
    triggeredBy = "system"
  ): Promise<AgentResult> {
    const agent = this.agents.get(name);
    if (!agent) {
      return {
        success: false,
        agent: name,
        requestId: randomUUID(),
        duration: 0,
        error: `Agente "${name}" não encontrado no registry.`,
        logs: [],
      };
    }

    const context: AgentContext = {
      requestId: randomUUID(),
      triggeredBy,
      params,
    };

    return agent.run(context);
  }

  // ─── HEALTH ─────────────────────────────────────────────────────────────────

  /**
   * Coleta o status de saúde de todos os agentes registrados.
   */
  async getHealthReport(): Promise<HealthReport> {
    const statuses = await Promise.all(
      Array.from(this.agents.values()).map(async (agent) => {
        try {
          return await agent.healthCheck();
        } catch (err) {
          return {
            healthy: false,
            agent: agent.name,
            status: agent.status,
            lastCheck: new Date(),
            errorMessage: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    return {
      overallHealthy: statuses.every((s) => s.healthy),
      timestamp: new Date(),
      agents: statuses,
    };
  }

  // ─── ACESSO ─────────────────────────────────────────────────────────────────

  /**
   * Retorna um agente pelo nome, com cast para o tipo correto.
   *
   * @example
   * const syncAgent = registry.getAgent<DataSyncAgent>("data-sync");
   */
  getAgent<T extends BaseAgent>(name: string): T | undefined {
    return this.agents.get(name) as T | undefined;
  }

  /**
   * Lista todos os agentes registrados com seus status.
   */
  listAgents(): Array<{
    name: string;
    domain: string;
    version: string;
    status: string;
    stats: { totalExecutions: number; lastExecutionTime: number; consecutiveFailures: number };
  }> {
    return Array.from(this.agents.values()).map((agent) => ({
      name: agent.name,
      domain: agent.domain,
      version: agent.version,
      status: agent.status,
      stats: agent.stats,
    }));
  }

  /**
   * Retorna o EventBus compartilhado.
   */
  getEventBus(): EventBus {
    return EventBus.getInstance();
  }

  // ─── SHUTDOWN ───────────────────────────────────────────────────────────────

  /**
   * Desliga todos os agentes na ordem inversa de inicialização.
   */
  async shutdown(): Promise<void> {
    console.log("[AgentRegistry] 🛑 Graceful shutdown iniciado...");

    // Shutdown na ordem inversa da inicialização
    const reverseOrder = [...this.initOrder].reverse();

    for (const name of reverseOrder) {
      const agent = this.agents.get(name);
      if (agent) {
        try {
          await agent.shutdown();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[AgentRegistry] ⚠️ Erro ao desligar "${name}": ${msg}`);
        }
      }
    }

    this.initialized = false;
    console.log("[AgentRegistry] ⏹️ Todos os agentes desligados.");
  }
}
