/**
 * server/agents/index.ts
 *
 * Barrel export e função de bootstrap do sistema multi-agente.
 *
 * Uso no server/index.ts:
 *   import { bootstrapAgents, getRegistry } from "./agents";
 *   await bootstrapAgents();
 */

import { AgentRegistry } from "./_framework";
import { DataSyncAgent } from "./data-sync.agent";
import { NotificationAgent } from "./notification.agent";
import { LogisticsAgent } from "./logistics.agent";
import { AnalyticsAgent } from "./analytics.agent";
import { TaskAutomationAgent } from "./task-automation.agent";

// Re-exporta agentes individuais para acesso direto se necessário
export { DataSyncAgent } from "./data-sync.agent";
export { NotificationAgent } from "./notification.agent";
export { LogisticsAgent } from "./logistics.agent";
export { AnalyticsAgent } from "./analytics.agent";
export { TaskAutomationAgent } from "./task-automation.agent";

/**
 * Inicializa todo o sistema multi-agente.
 * Registra todos os agentes com suas dependências e faz o boot ordenado.
 *
 * Ordem de inicialização (resolvida automaticamente pelo registry):
 * 1. data-sync     (sem dependências)
 * 2. notification   (sem dependências — escuta eventos passivamente)
 * 3. logistics      (depende de data-sync — escuta sync:completed)
 * 4. analytics      (depende de data-sync — escuta sync:completed)
 * 5. task-automation (depende de analytics — escuta anomaly_detected)
 */
export async function bootstrapAgents(): Promise<AgentRegistry> {
  const registry = AgentRegistry.getInstance();

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║       🤖 SISTEMA MULTI-AGENTE — BOOT        ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ─── Registro com dependências ──────────────────────────────────────────────

  registry.register(new DataSyncAgent(), {
    dependencies: [],
    circuitBreaker: { failureThreshold: 3, recoveryTimeout: 120_000 },
  });

  registry.register(new NotificationAgent(), {
    dependencies: [],
    circuitBreaker: { failureThreshold: 5, recoveryTimeout: 60_000 },
  });

  registry.register(new LogisticsAgent(), {
    dependencies: ["data-sync"],
    circuitBreaker: { failureThreshold: 3, recoveryTimeout: 120_000 },
  });

  registry.register(new AnalyticsAgent(), {
    dependencies: ["data-sync"],
    circuitBreaker: { failureThreshold: 5, recoveryTimeout: 60_000 },
  });

  registry.register(new TaskAutomationAgent(), {
    dependencies: ["analytics"],
    circuitBreaker: { failureThreshold: 5, recoveryTimeout: 60_000 },
  });

  // ─── Boot ordenado ──────────────────────────────────────────────────────────

  await registry.initializeAll();

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║     ✅ TODOS OS AGENTES INICIALIZADOS       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  return registry;
}

/**
 * Atalho para acessar o registry de qualquer lugar do código.
 */
export function getRegistry(): AgentRegistry {
  return AgentRegistry.getInstance();
}
