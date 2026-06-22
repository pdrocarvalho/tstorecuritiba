/**
 * server/agents/_framework/index.ts
 *
 * Barrel export do framework multi-agente.
 * Importar tudo daqui: import { BaseAgent, EventBus, AgentRegistry } from "./_framework";
 */

export { BaseAgent } from "./base-agent";
export { EventBus } from "./event-bus";
export { AgentRegistry } from "./agent-registry";

export type {
  AgentContext,
  AgentResult,
  AgentConfig,
  AgentStatus,
  HealthStatus,
  HealthReport,
  LogLevel,
  AgentEventMap,
  AgentEventKey,
  AgentEventPayload,
  AgentEventHandler,
  EventMeta,
  EventBusMetrics,
} from "./types";
