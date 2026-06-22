/**
 * server/agents/logistics.agent.ts
 *
 * Agente especializado em logística e cruzamento de demandas.
 * Orquestra a automação de demandas, cross-reference e resolução de conflitos.
 *
 * Domínio: Logística
 * Escuta: sync:completed
 * Emite: logistics:status_changed, logistics:conflict_detected, logistics:automation_completed
 */

import { BaseAgent, AgentContext, AgentResult, HealthStatus } from "./_framework";
import { rodarAutomacaoLogistica, aplicarResolucaoConflito } from "../engines/notification.engine";
import { env } from "../_core/env";

export class LogisticsAgent extends BaseAgent {
  readonly name = "logistics";
  readonly domain = "logistica";
  readonly version = "1.0.0";

  // ─── CICLO DE VIDA ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    // Escuta sync:completed para rodar automação logística automaticamente
    this.on("sync:completed", async (payload, meta) => {
      this.log("info", `Sync concluída (${payload.recordCount} registros). Avaliando automação logística...`);

      // Só roda automação se o sync incluiu recebimentos ou foi full
      if (payload.mode === "recebimentos" || payload.mode === "full") {
        try {
          await this.runAutomation();
        } catch (err) {
          this.log("error", `Automação pós-sync falhou: ${err instanceof Error ? err.message : err}`);
        }
      }
    });

    this.log("info", "Subscribed a sync:completed para automação reativa.");
  }

  // ─── EXECUÇÃO PRINCIPAL ─────────────────────────────────────────────────────

  async execute(context: AgentContext): Promise<AgentResult> {
    const logs: string[] = [];
    const action = (context.params.action as string) || "automate";

    try {
      if (action === "automate") {
        const result = await this.runAutomation();
        logs.push(result.mensagem);

        return {
          success: true,
          agent: this.name,
          requestId: context.requestId,
          duration: 0,
          data: result,
          logs,
        };

      } else if (action === "resolve_conflicts") {
        const resolucoes = context.params.resolucoes as any[];
        const urlDemandas = (context.params.urlDemandas as string) || process.env.SHEET_ID_DEMANDAS;

        if (!urlDemandas) {
          throw new Error("URL de Demandas não fornecida e SHEET_ID_DEMANDAS não configurado.");
        }

        const result = await aplicarResolucaoConflito(urlDemandas, resolucoes);
        logs.push(`${result.count} resolução(ões) aplicada(s).`);

        return {
          success: true,
          agent: this.name,
          requestId: context.requestId,
          duration: 0,
          data: result,
          logs,
        };

      } else {
        throw new Error(`Ação desconhecida: ${action}`);
      }

    } catch (error) {
      throw error;
    }
  }

  // ─── AUTOMAÇÃO LOGÍSTICA ────────────────────────────────────────────────────

  private async runAutomation(): Promise<{
    updatesApplied: number;
    conflitosCount: number;
    mensagem: string;
  }> {
    const urlRecebimento = env.DB_SPREADSHEET_ID;
    const urlDemandas = process.env.SHEET_ID_DEMANDAS;

    if (!urlRecebimento) {
      throw new Error("DB_SPREADSHEET_ID não configurado.");
    }
    if (!urlDemandas) {
      throw new Error("SHEET_ID_DEMANDAS não configurado.");
    }

    this.log("info", "Rodando automação logística (cross-reference + alocação)...");

    const result = await rodarAutomacaoLogistica(urlRecebimento, urlDemandas);

    // Emite eventos para cada conflito detectado
    if (result.conflitos && result.conflitos.length > 0) {
      for (const conflito of result.conflitos) {
        this.emit("logistics:conflict_detected", {
          ref: conflito.ref,
          tipo: conflito.tipo,
          demandasCount: conflito.demandas?.length || 0,
          ofertaDisponivel: conflito.ofertaDisponivel,
          timestamp: new Date(),
        });
      }
    }

    // Emite evento de conclusão
    this.emit("logistics:automation_completed", {
      updatesApplied: result.updatesApplied,
      conflitosCount: result.conflitos?.length || 0,
      timestamp: new Date(),
    });

    return {
      updatesApplied: result.updatesApplied,
      conflitosCount: result.conflitos?.length || 0,
      mensagem: result.mensagem,
    };
  }

  // ─── HEALTH CHECK ───────────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthStatus> {
    const dbSpreadsheetConfigured = !!env.DB_SPREADSHEET_ID;
    const demandasConfigured = !!process.env.SHEET_ID_DEMANDAS;

    return {
      healthy: dbSpreadsheetConfigured,
      agent: this.name,
      status: this.status,
      lastCheck: new Date(),
      details: {
        dbSpreadsheetConfigured,
        demandasConfigured,
        stats: this.stats,
      },
    };
  }
}
