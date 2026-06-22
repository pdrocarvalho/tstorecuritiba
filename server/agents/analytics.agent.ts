/**
 * server/agents/analytics.agent.ts
 *
 * Agente especializado em inteligência e análise de dados.
 * Calcula KPIs, detecta anomalias e gera insights usando Gemini AI.
 *
 * Domínio: Inteligência
 * Escuta: sync:completed, logistics:automation_completed
 * Emite: analytics:anomaly_detected, analytics:kpis_computed
 */

import { BaseAgent, AgentContext, AgentResult, HealthStatus } from "./_framework";
import { analisarComIA } from "../engines/ai.engine";
import { getDb } from "../db";
import { pedidosRastreio, avarias, demandas } from "../../drizzle/schema";
import { eq, sql, count } from "drizzle-orm";

interface KPISnapshot {
  totalRecebimentos: number;
  totalAvarias: number;
  totalDemandas: number;
  taxaAvaria: number;
  recebimentosPorStatus: Record<string, number>;
  topReferenciasComAvaria: string[];
}

export class AnalyticsAgent extends BaseAgent {
  readonly name = "analytics";
  readonly domain = "inteligencia";
  readonly version = "1.0.0";

  private lastKpiSnapshot: KPISnapshot | null = null;

  // ─── CICLO DE VIDA ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    // Escuta sync completada para recalcular KPIs
    this.on("sync:completed", async (payload, meta) => {
      this.log("info", `Sync detectada (${payload.recordCount} registros). Recalculando KPIs...`);

      try {
        const kpis = await this.computeKPIs();
        this.lastKpiSnapshot = kpis;

        this.emit("analytics:kpis_computed", {
          period: new Date().toISOString().slice(0, 10),
          metrics: {
            totalRecebimentos: kpis.totalRecebimentos,
            totalAvarias: kpis.totalAvarias,
            totalDemandas: kpis.totalDemandas,
            taxaAvaria: kpis.taxaAvaria,
          },
          timestamp: new Date(),
        }, meta.requestId);

        // Verifica anomalias com base nos KPIs
        await this.detectAnomalies(kpis, meta.requestId);

      } catch (err) {
        this.log("error", `Falha ao computar KPIs pós-sync: ${err instanceof Error ? err.message : err}`);
      }
    });

    // Escuta automação logística para detectar padrões
    this.on("logistics:automation_completed", async (payload, meta) => {
      if (payload.conflitosCount > 3) {
        this.emit("analytics:anomaly_detected", {
          type: "pico_demanda",
          description: `${payload.conflitosCount} conflitos de oferta/demanda detectados em uma única execução. Possível pico de demanda.`,
          severity: "warning",
          timestamp: new Date(),
        }, meta.requestId);
      }
    });

    this.log("info", "Subscribed a sync:completed e logistics:automation_completed.");
  }

  // ─── EXECUÇÃO PRINCIPAL ─────────────────────────────────────────────────────

  async execute(context: AgentContext): Promise<AgentResult> {
    const logs: string[] = [];
    const action = (context.params.action as string) || "full_analysis";

    try {
      if (action === "kpis") {
        const kpis = await this.computeKPIs();
        this.lastKpiSnapshot = kpis;
        logs.push("KPIs calculados com sucesso.");

        return {
          success: true,
          agent: this.name,
          requestId: context.requestId,
          duration: 0,
          data: kpis,
          logs,
        };

      } else if (action === "ai_analysis") {
        const prompt = (context.params.prompt as string) || await this.buildAutoPrompt();
        const aiResult = await analisarComIA(prompt);
        logs.push(aiResult.sucesso ? "Análise IA concluída." : `Falha IA: ${aiResult.erro}`);

        return {
          success: aiResult.sucesso,
          agent: this.name,
          requestId: context.requestId,
          duration: 0,
          data: aiResult,
          logs,
        };

      } else if (action === "full_analysis") {
        // KPIs + detecção de anomalias
        const kpis = await this.computeKPIs();
        this.lastKpiSnapshot = kpis;
        logs.push("KPIs calculados.");

        await this.detectAnomalies(kpis, context.requestId);
        logs.push("Anomalias verificadas.");

        return {
          success: true,
          agent: this.name,
          requestId: context.requestId,
          duration: 0,
          data: { kpis },
          logs,
        };

      } else {
        throw new Error(`Ação desconhecida: ${action}`);
      }

    } catch (error) {
      throw error;
    }
  }

  // ─── KPIs ───────────────────────────────────────────────────────────────────

  private async computeKPIs(): Promise<KPISnapshot> {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados não disponível.");

    // Total de recebimentos por status
    const recebimentos = await db
      .select({
        status: pedidosRastreio.orderStatus,
        total: count(),
      })
      .from(pedidosRastreio)
      .groupBy(pedidosRastreio.orderStatus);

    const statusMap: Record<string, number> = {};
    let totalRec = 0;
    for (const row of recebimentos) {
      statusMap[row.status] = Number(row.total);
      totalRec += Number(row.total);
    }

    // Total de avarias
    const avariasResult = await db.select({ total: count() }).from(avarias);
    const totalAv = Number(avariasResult[0]?.total || 0);

    // Total de demandas
    const demandasResult = await db.select({ total: count() }).from(demandas);
    const totalDem = Number(demandasResult[0]?.total || 0);

    // Top refs com avaria
    const topAvarias = await db
      .select({
        ref: avarias.produtoSku,
        total: count(),
      })
      .from(avarias)
      .groupBy(avarias.produtoSku)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    return {
      totalRecebimentos: totalRec,
      totalAvarias: totalAv,
      totalDemandas: totalDem,
      taxaAvaria: totalRec > 0 ? Math.round((totalAv / totalRec) * 10000) / 100 : 0,
      recebimentosPorStatus: statusMap,
      topReferenciasComAvaria: topAvarias.map((r) => r.ref || "N/A"),
    };
  }

  // ─── DETECÇÃO DE ANOMALIAS ──────────────────────────────────────────────────

  private async detectAnomalies(kpis: KPISnapshot, requestId?: string): Promise<void> {
    // Taxa de avaria acima de 5% — warning
    if (kpis.taxaAvaria > 5) {
      this.emit("analytics:anomaly_detected", {
        type: "divergencia_estoque",
        description: `Taxa de avaria está em ${kpis.taxaAvaria}% (acima do limiar de 5%). Top referências: ${kpis.topReferenciasComAvaria.join(", ")}.`,
        severity: kpis.taxaAvaria > 10 ? "critical" : "warning",
        relatedRefs: kpis.topReferenciasComAvaria,
        timestamp: new Date(),
      }, requestId);
    }

    // Taxa de avaria acima de 15% — critical
    if (kpis.taxaAvaria > 15) {
      this.emit("analytics:anomaly_detected", {
        type: "divergencia_estoque",
        description: `CRÍTICO: Taxa de avaria em ${kpis.taxaAvaria}%. Investigação urgente necessária.`,
        severity: "critical",
        relatedRefs: kpis.topReferenciasComAvaria,
        timestamp: new Date(),
      }, requestId);
    }
  }

  // ─── PROMPT AUTOMÁTICO ──────────────────────────────────────────────────────

  private async buildAutoPrompt(): Promise<string> {
    const kpis = this.lastKpiSnapshot || await this.computeKPIs();

    return `Analise os seguintes KPIs de uma loja de estoque e dê insights:
- Total de recebimentos: ${kpis.totalRecebimentos}
- Total de avarias: ${kpis.totalAvarias} (taxa: ${kpis.taxaAvaria}%)
- Total de demandas: ${kpis.totalDemandas}
- Status dos recebimentos: ${JSON.stringify(kpis.recebimentosPorStatus)}
- Top referências com avaria: ${kpis.topReferenciasComAvaria.join(", ")}

Responda em português, de forma concisa, com no máximo 3 recomendações acionáveis.`;
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
          lastKpiSnapshot: this.lastKpiSnapshot ? "available" : "not computed",
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
