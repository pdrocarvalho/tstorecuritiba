/**
 * server/agents/_framework/types.ts
 *
 * Tipos, interfaces e enums compartilhados por todo o framework de multi-agente.
 * Este arquivo é o contrato central — qualquer agente ou componente do sistema
 * deve importar seus tipos daqui.
 */

// ---------------------------------------------------------------------------
// Ciclo de Vida do Agente
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

export type AgentStatus =
  | "registered"   // Registrado mas não inicializado
  | "initializing" // Em processo de boot
  | "ready"        // Pronto para executar
  | "running"      // Executando uma tarefa
  | "error"        // Último health check falhou
  | "disabled";    // Desabilitado por circuit breaker

export interface HealthStatus {
  healthy: boolean;
  agent: string;
  status: AgentStatus;
  lastCheck: Date;
  details?: Record<string, unknown>;
  errorMessage?: string;
}

export interface HealthReport {
  overallHealthy: boolean;
  timestamp: Date;
  agents: HealthStatus[];
}

// ---------------------------------------------------------------------------
// Contexto e Resultado de Execução
// ---------------------------------------------------------------------------

export interface AgentContext {
  /** UUID único para rastreabilidade ponta-a-ponta */
  requestId: string;

  /** Quem iniciou a execução: "user", "cron", "agent:<nome>" */
  triggeredBy: string;

  /** Parâmetros específicos da execução */
  params: Record<string, unknown>;

  /** Signal para cancelamento gracioso */
  abortSignal?: AbortSignal;
}

export interface AgentResult {
  success: boolean;
  agent: string;
  requestId: string;
  duration: number;  // em ms
  data?: unknown;
  error?: string;
  logs: string[];
}

// ---------------------------------------------------------------------------
// Configuração de Agente
// ---------------------------------------------------------------------------

export interface AgentConfig {
  /** Agentes dos quais este depende (devem ser inicializados primeiro) */
  dependencies?: string[];

  /** Se o agente está habilitado */
  enabled?: boolean;

  /** Configurações de circuit breaker */
  circuitBreaker?: {
    /** Número de falhas consecutivas antes de desabilitar */
    failureThreshold: number;
    /** Tempo em ms antes de tentar reativar */
    recoveryTimeout: number;
  };
}

// ---------------------------------------------------------------------------
// Mapa de Eventos — Contrato Central de Comunicação Inter-Agente
// ---------------------------------------------------------------------------

/**
 * Toda comunicação inter-agente passa por este mapa tipado.
 * Para adicionar um novo evento, basta adicionar uma nova chave aqui.
 * O TypeScript garante em compile-time que todos os payloads estão corretos.
 */
export interface AgentEventMap {
  // ─── DataSyncAgent ────────────────────────────────────────────────────────
  "sync:completed": {
    mode: "avarias" | "demandas" | "recebimentos" | "full";
    recordCount: number;
    logs: string[];
    timestamp: Date;
  };
  "sync:failed": {
    mode: string;
    error: string;
    timestamp: Date;
  };

  // ─── LogisticsAgent ───────────────────────────────────────────────────────
  "logistics:status_changed": {
    ref: string;
    from: string;
    to: string;
    demandaAba: string;
    rowNumber: number;
    timestamp: Date;
  };
  "logistics:conflict_detected": {
    ref: string;
    tipo: string;
    demandasCount: number;
    ofertaDisponivel: number;
    timestamp: Date;
  };
  "logistics:automation_completed": {
    updatesApplied: number;
    conflitosCount: number;
    timestamp: Date;
  };

  // ─── NotificationAgent ────────────────────────────────────────────────────
  "notification:send_requested": {
    to: string;
    subject: string;
    body: string;
    priority: "low" | "normal" | "high";
    channel: "email" | "webhook" | "both";
    timestamp: Date;
  };
  "notification:sent": {
    to: string;
    channel: string;
    success: boolean;
    timestamp: Date;
  };

  // ─── AnalyticsAgent ───────────────────────────────────────────────────────
  "analytics:anomaly_detected": {
    type: "atraso_recorrente" | "divergencia_estoque" | "pico_demanda" | "outro";
    description: string;
    severity: "info" | "warning" | "critical";
    relatedRefs?: string[];
    timestamp: Date;
  };
  "analytics:kpis_computed": {
    period: string;
    metrics: Record<string, number>;
    timestamp: Date;
  };

  // ─── TaskAutomationAgent ──────────────────────────────────────────────────
  "task:auto_created": {
    taskId: number;
    titulo: string;
    reason: string;
    timestamp: Date;
  };
  "task:escalation_needed": {
    taskId: number;
    reason: string;
    assignedTo: number;
    daysOverdue: number;
    timestamp: Date;
  };

  // ─── AvariasAgent ─────────────────────────────────────────────────────────
  "avarias:stalled_process": {
    avariaId: number;
    produtoSku: string | null;
    status: string | null;
    tratativa: string | null;
    daysStalled: number;
    timestamp: Date;
  };
  "avarias:resolution_completed": {
    avariaId: number;
    produtoSku: string | null;
    timestamp: Date;
  };
}

/** Chave de qualquer evento válido no sistema */
export type AgentEventKey = keyof AgentEventMap;

/** Payload de um evento específico */
export type AgentEventPayload<K extends AgentEventKey> = AgentEventMap[K];

/** Handler genérico de evento */
export type AgentEventHandler<K extends AgentEventKey> = (
  payload: AgentEventPayload<K>,
  meta: EventMeta
) => void | Promise<void>;

/** Metadados que acompanham todo evento */
export interface EventMeta {
  eventId: string;
  emittedBy: string;
  emittedAt: Date;
  requestId?: string;
}

// ---------------------------------------------------------------------------
// Subscrição interna do EventBus
// ---------------------------------------------------------------------------

export interface EventSubscription {
  id: string;
  event: string;
  agentName: string;
  handler: AgentEventHandler<any>;
  isWildcard: boolean;
}

// ---------------------------------------------------------------------------
// Métricas do EventBus
// ---------------------------------------------------------------------------

export interface EventBusMetrics {
  totalEmitted: number;
  totalConsumed: number;
  deadLetterCount: number;
  eventCounts: Record<string, number>;
  subscriberCounts: Record<string, number>;
}
