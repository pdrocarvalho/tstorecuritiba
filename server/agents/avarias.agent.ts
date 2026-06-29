/**
 * server/agents/avarias.agent.ts
 *
 * Agente especializado na gestão de avarias (Qualidade).
 * Monitora proativamente produtos com defeito e identifica paralisações
 * no processo de troca/reposição junto à fábrica.
 *
 * Domínio: Qualidade / Avarias
 * Escuta: sync:completed
 * Emite: avarias:stalled_process, avarias:resolution_completed
 */

import { BaseAgent, AgentContext, AgentResult, HealthStatus } from "./_framework";
import { getDb } from "../db";
import { avarias } from "../../drizzle/schema";
import { eq, or, ilike, and, isNull, sql } from "drizzle-orm";

export class AvariasAgent extends BaseAgent {
  readonly name = "avarias";
  readonly domain = "qualidade";
  readonly version = "1.0.0";

  // ─── CICLO DE VIDA ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    // Reage sempre que a planilha de avarias for sincronizada
    this.on("sync:completed", async (payload, meta) => {
      if (payload.mode === "avarias" || payload.mode === "full") {
        this.log("info", "Sincronização de avarias concluída. Avaliando processos paralisados...");
        try {
          await this.checkStalledAvarias(meta.requestId);
        } catch (err) {
          this.log("error", `Falha ao avaliar avarias: ${err instanceof Error ? err.message : err}`);
        }
      }
    });

    this.log("info", "Subscribed a sync:completed para monitoramento proativo.");
  }

  // ─── EXECUÇÃO PRINCIPAL ─────────────────────────────────────────────────────

  async execute(context: AgentContext): Promise<AgentResult> {
    const logs: string[] = [];
    const action = (context.params.action as string) || "check_stalled";

    try {
      if (action === "check_stalled") {
        const stalledCount = await this.checkStalledAvarias(context.requestId);
        logs.push(`${stalledCount} avaria(s) paralisada(s) detectada(s) e alertada(s).`);

        return {
          success: true,
          agent: this.name,
          requestId: context.requestId,
          duration: 0,
          data: { stalledCount },
          logs,
        };

      } else {
        throw new Error(`Ação desconhecida: ${action}`);
      }
    } catch (error) {
      throw error;
    }
  }

  // ─── VERIFICAÇÃO DE AVARIAS PARALISADAS ─────────────────────────────────────

  private async checkStalledAvarias(requestId?: string): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados não disponível.");

    // Avarias que estão com tratativa PENDENTE ou EM PROCESSO
    // Consideramos paralisadas aquelas que já estão cadastradas há alguns dias
    // Como a tabela não possui um controle forte de estados, usamos o createdAt como base provisória,
    // ou se a NF de reposição continua vazia.
    
    // Regra acordada: TRATATIVA em "PENDENTE" ou "EM PROCESSO" sem NF de reposição.
    const stalledItems = await db
      .select()
      .from(avarias)
      .where(
        and(
          or(
            ilike(avarias.tratativa, "%pendente%"),
            ilike(avarias.tratativa, "%em processo%"),
            ilike(avarias.tratativa, "%em análise%")
          ),
          or(
            isNull(avarias.notaFiscalDeReposicao),
            eq(avarias.notaFiscalDeReposicao, "")
          )
        )
      );

    const now = new Date();
    let stalledAlertsCount = 0;

    for (const item of stalledItems) {
      // Prioridade: data de mudança da tratativa. Se não existir, usa a data de criação.
      const referenceDate = item.dataMudancaTratativa
        ? new Date(item.dataMudancaTratativa)
        : (item.createdAt ? new Date(item.createdAt) : now);

      const daysStalled = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

      // Emite alerta apenas se estiver parado a mais de 2 dias (para evitar spam imediato após cadastro)
      if (daysStalled >= 2) {
        this.emit("avarias:stalled_process", {
          avariaId: item.id,
          produtoSku: item.produtoSku,
          status: item.status,
          tratativa: item.tratativa,
          daysStalled,
          timestamp: new Date(),
        }, requestId);

        stalledAlertsCount++;
        this.log("warn", `Avaria #${item.id} (SKU: ${item.produtoSku}) estagnada há ${daysStalled} dias (Tratativa: ${item.tratativa}).`);
      }
    }

    return stalledAlertsCount;
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
