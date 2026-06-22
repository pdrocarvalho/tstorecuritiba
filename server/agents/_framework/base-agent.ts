/**
 * server/agents/_framework/base-agent.ts
 *
 * Classe abstrata que todo agente do sistema deve estender.
 *
 * Define o contrato obrigatório:
 * - initialize(): Setup de conexões, caches, validações
 * - execute(): Lógica principal do agente
 * - healthCheck(): Verificação de saúde
 *
 * Fornece infraestrutura pronta:
 * - Comunicação via EventBus (emit/on)
 * - Logging estruturado com prefixo do agente
 * - Circuit breaker automático
 * - Métricas de execução
 */

import { EventBus } from "./event-bus";
import type {
  AgentContext,
  AgentResult,
  AgentConfig,
  AgentStatus,
  HealthStatus,
  LogLevel,
  AgentEventKey,
  AgentEventPayload,
  AgentEventHandler,
} from "./types";

export abstract class BaseAgent {
  // ─── PROPRIEDADES ABSTRATAS (cada agente DEVE definir) ──────────────────────

  /** Identificador único do agente (ex: "data-sync") */
  abstract readonly name: string;

  /** Domínio de atuação (ex: "sincronizacao", "logistica") */
  abstract readonly domain: string;

  /** Versão semântica (ex: "1.0.0") */
  abstract readonly version: string;

  // ─── MÉTODOS ABSTRATOS (cada agente DEVE implementar) ──────────────────────

  /** Setup: conexões, validações, subscriptions. Chamado uma vez no boot. */
  abstract initialize(): Promise<void>;

  /** Lógica principal do agente. */
  abstract execute(context: AgentContext): Promise<AgentResult>;

  /** Verificação de saúde. Retorna detalhes sobre o estado do agente. */
  abstract healthCheck(): Promise<HealthStatus>;

  // ─── ESTADO INTERNO ─────────────────────────────────────────────────────────

  private _status: AgentStatus = "registered";
  private _config: AgentConfig = {};
  private _consecutiveFailures = 0;
  private _lastExecutionTime = 0;
  private _totalExecutions = 0;
  private _subscriptionIds: string[] = [];

  protected readonly eventBus: EventBus = EventBus.getInstance();

  // ─── GETTERS ────────────────────────────────────────────────────────────────

  get status(): AgentStatus {
    return this._status;
  }

  get config(): AgentConfig {
    return this._config;
  }

  get stats() {
    return {
      totalExecutions: this._totalExecutions,
      lastExecutionTime: this._lastExecutionTime,
      consecutiveFailures: this._consecutiveFailures,
    };
  }

  // ─── CONFIGURAÇÃO ───────────────────────────────────────────────────────────

  configure(config: AgentConfig): void {
    this._config = { ...this._config, ...config };
  }

  // ─── CICLO DE VIDA ──────────────────────────────────────────────────────────

  /**
   * Wrapper de inicialização — chama o initialize() do agente concreto
   * com tratamento de erros e transição de status.
   */
  async boot(): Promise<void> {
    if (this._status === "ready" || this._status === "running") {
      this.log("warn", "Agente já está inicializado ou rodando, ignorando boot.");
      return;
    }

    this._status = "initializing";
    this.log("info", `Inicializando v${this.version}...`);

    try {
      await this.initialize();
      this._status = "ready";
      this.log("info", "✅ Inicializado com sucesso.");
    } catch (err) {
      this._status = "error";
      const msg = err instanceof Error ? err.message : String(err);
      this.log("error", `❌ Falha na inicialização: ${msg}`);
      throw err;
    }
  }

  /**
   * Wrapper de execução — adiciona métricas, circuit breaker e logging.
   */
  async run(context: AgentContext): Promise<AgentResult> {
    // Circuit breaker
    if (this._status === "disabled") {
      return {
        success: false,
        agent: this.name,
        requestId: context.requestId,
        duration: 0,
        error: "Agente desabilitado pelo circuit breaker. Aguarde recovery.",
        logs: [],
      };
    }

    if (this._status !== "ready") {
      return {
        success: false,
        agent: this.name,
        requestId: context.requestId,
        duration: 0,
        error: `Agente não está pronto. Status atual: ${this._status}`,
        logs: [],
      };
    }

    this._status = "running";
    const startTime = Date.now();

    this.log("info", `Executando (requestId: ${context.requestId.slice(0, 8)}, triggeredBy: ${context.triggeredBy})`);

    try {
      const result = await this.execute(context);
      this._lastExecutionTime = Date.now() - startTime;
      this._totalExecutions++;
      this._consecutiveFailures = 0;
      this._status = "ready";

      this.log("info", `✅ Concluído em ${this._lastExecutionTime}ms`);
      return result;

    } catch (err) {
      this._lastExecutionTime = Date.now() - startTime;
      this._totalExecutions++;
      this._consecutiveFailures++;
      this._status = "ready";

      const errorMsg = err instanceof Error ? err.message : String(err);
      this.log("error", `❌ Falha após ${this._lastExecutionTime}ms: ${errorMsg}`);

      // Circuit breaker: desabilita se exceder threshold
      const threshold = this._config.circuitBreaker?.failureThreshold ?? 5;
      if (this._consecutiveFailures >= threshold) {
        this._status = "disabled";
        this.log("error", `🔌 Circuit breaker ativado após ${this._consecutiveFailures} falhas consecutivas.`);

        // Auto-recovery
        const recoveryTimeout = this._config.circuitBreaker?.recoveryTimeout ?? 60_000;
        setTimeout(() => {
          this.log("info", "🔄 Tentando recovery do circuit breaker...");
          this._status = "ready";
          this._consecutiveFailures = 0;
        }, recoveryTimeout);
      }

      return {
        success: false,
        agent: this.name,
        requestId: context.requestId,
        duration: this._lastExecutionTime,
        error: errorMsg,
        logs: [],
      };
    }
  }

  /**
   * Desconecta o agente — remove todas as subscriptions.
   */
  async shutdown(): Promise<void> {
    this.log("info", "Desligando...");
    for (const subId of this._subscriptionIds) {
      this.eventBus.off(subId);
    }
    this._subscriptionIds = [];
    this._status = "registered";
    this.log("info", "⏹️ Desligado.");
  }

  // ─── COMUNICAÇÃO VIA EVENTBUS ───────────────────────────────────────────────

  /**
   * Emite um evento tipado no barramento.
   */
  protected emit<K extends AgentEventKey>(
    event: K,
    payload: AgentEventPayload<K>,
    requestId?: string
  ): void {
    // Fire-and-forget — não bloqueia o agente
    this.eventBus.emit(event, payload, this.name, requestId).catch((err) => {
      this.log("error", `Falha ao emitir evento "${event}": ${err instanceof Error ? err.message : err}`);
    });
  }

  /**
   * Registra um handler para um evento específico.
   */
  protected on<K extends AgentEventKey>(
    event: K,
    handler: AgentEventHandler<K>
  ): string {
    const subId = this.eventBus.on(event, handler, this.name);
    this._subscriptionIds.push(subId);
    return subId;
  }

  /**
   * Registra um handler wildcard para todos os eventos de um domínio.
   */
  protected onWildcard(
    domainPrefix: string,
    handler: AgentEventHandler<any>
  ): string {
    const subId = this.eventBus.onWildcard(domainPrefix, handler, this.name);
    this._subscriptionIds.push(subId);
    return subId;
  }

  // ─── LOGGING ESTRUTURADO ────────────────────────────────────────────────────

  /**
   * Log com prefixo padronizado do agente.
   */
  protected log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const prefix = `[${this.name}]`;
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";

    switch (level) {
      case "debug":
        console.debug(`${prefix} ${message}${metaStr}`);
        break;
      case "info":
        console.log(`${prefix} ${message}${metaStr}`);
        break;
      case "warn":
        console.warn(`${prefix} ${message}${metaStr}`);
        break;
      case "error":
        console.error(`${prefix} ${message}${metaStr}`);
        break;
    }
  }
}
