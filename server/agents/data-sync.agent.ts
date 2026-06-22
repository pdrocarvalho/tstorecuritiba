/**
 * server/agents/data-sync.agent.ts
 *
 * Agente especializado em sincronização de dados.
 * Importa dados do Google Sheets para o PostgreSQL.
 *
 * Domínio: Sincronização
 * Emite: sync:completed, sync:failed
 * Escuta: nenhum (é o ponto de entrada do pipeline)
 */

import { BaseAgent, AgentContext, AgentResult, HealthStatus } from "./_framework";
import { getDb } from "../db";
import { fetchLiveGoogleSheet } from "../engines/sync.engine";
import { avarias, demandas, pedidosRastreio, produtos } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export class DataSyncAgent extends BaseAgent {
  readonly name = "data-sync";
  readonly domain = "sincronizacao";
  readonly version = "2.0.0";

  // ─── CICLO DE VIDA ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    // Valida que o banco está acessível
    const db = await getDb();
    if (!db) {
      throw new Error("Banco de dados não disponível durante inicialização.");
    }

    this.log("info", "Conexão com banco validada.");

    // Valida que há pelo menos um SHEET_ID configurado
    const hasSheets =
      process.env.SHEET_ID_AVARIAS ||
      process.env.SHEET_ID_DEMANDAS ||
      process.env.SHEET_ID_RECEBIMENTOS;

    if (!hasSheets) {
      this.log("warn", "Nenhum SHEET_ID configurado no .env. O agente funcionará mas não sincronizará sem URLs.");
    }
  }

  // ─── EXECUÇÃO PRINCIPAL ─────────────────────────────────────────────────────

  async execute(context: AgentContext): Promise<AgentResult> {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados não disponível.");

    const logs: string[] = [];
    let totalRecords = 0;

    // URLs podem vir dos params ou do .env
    const urls = {
      avarias: (context.params.avarias as string) || process.env.SHEET_ID_AVARIAS,
      demandas: (context.params.demandas as string) || process.env.SHEET_ID_DEMANDAS,
      recebimentos: (context.params.recebimentos as string) || process.env.SHEET_ID_RECEBIMENTOS,
    };

    // Determina o modo de execução
    const mode = (context.params.mode as string) || "full";

    try {
      if ((mode === "full" || mode === "avarias") && urls.avarias) {
        const result = await this.syncAvarias(db, urls.avarias);
        logs.push(result.log);
        totalRecords += result.count;
      }

      if ((mode === "full" || mode === "demandas") && urls.demandas) {
        const result = await this.syncDemandas(db, urls.demandas);
        logs.push(result.log);
        totalRecords += result.count;
      }

      if ((mode === "full" || mode === "recebimentos") && urls.recebimentos) {
        const result = await this.syncRecebimentos(db, urls.recebimentos);
        logs.push(result.log);
        totalRecords += result.count;
      }

      // Emite evento de sucesso para os outros agentes
      this.emit("sync:completed", {
        mode: mode as any,
        recordCount: totalRecords,
        logs,
        timestamp: new Date(),
      }, context.requestId);

      return {
        success: true,
        agent: this.name,
        requestId: context.requestId,
        duration: 0, // será preenchido pelo BaseAgent.run()
        data: { totalRecords, logs },
        logs,
      };

    } catch (error: any) {
      // Emite evento de falha
      this.emit("sync:failed", {
        mode,
        error: error.message,
        timestamp: new Date(),
      }, context.requestId);

      throw error; // Re-throw para o BaseAgent tratar
    }
  }

  // ─── HEALTH CHECK ───────────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthStatus> {
    try {
      const db = await getDb();
      const dbOk = !!db;

      const sheetsConfigured = !!(
        process.env.SHEET_ID_AVARIAS ||
        process.env.SHEET_ID_DEMANDAS ||
        process.env.SHEET_ID_RECEBIMENTOS
      );

      return {
        healthy: dbOk,
        agent: this.name,
        status: this.status,
        lastCheck: new Date(),
        details: {
          databaseConnected: dbOk,
          sheetsConfigured,
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

  // ─── LÓGICA DE SYNC (migrada do código original) ────────────────────────────

  private async syncAvarias(db: any, sheetsUrl: string): Promise<{ log: string; count: number }> {
    this.log("info", "Buscando aba de Avarias...");
    const data = await fetchLiveGoogleSheet(sheetsUrl, "avarias");

    let inserted = 0;
    for (const record of data as any[]) {
      if (!record.REF) continue;

      if (!record.sheetId) {
        this.log("warn", `Linha ignorada em Avarias por falta de ID_AVARIA (Ref: ${record.REF})`);
        continue;
      }

      await this.ensureProductExists(db, record.REF, record.DESCRICAO || "Produto importado via Avarias");

      const novaAvaria = {
        sheetId: record.sheetId,
        produtoSku: record.REF,
        codAvaria: record.COD_AVARIA || null,
        fabrica: record.FABRICA || null,
        descricao: record.DESCRICAO || null,
        quantidade: record.QTDE ? parseInt(record.QTDE.replace(/\D/g, "")) || 1 : 1,
        tratativa: record.TRATATIVA || null,
        status: record.STATUS || null,
        okStatus: record.OK_STATUS || null,
        dataDaColeta: record.DATA_DA_COLETA || null,
        notaFiscalDeSaida: record.NOTA_FISCAL_DE_SAIDA || null,
        notaFiscalDeReposicao: record.NOTA_FISCAL_DE_REPOSICAO || null,
        foiLancadoNoSistema: record.FOI_LANCADO_NO_SISTEMA || null,
        constaFisicamente: record.CONSTA_FISICAMENTE || null,
        motivo: record.MOTIVO || null,
        dataDeEntrada: record.DATA_DE_ENTRADA || null,
        notaFiscalDeEntrada: record.NOTA_FISCAL_DE_ENTRADA || null,
        cupomFiscal: record.CUPOM_FISCAL || null,
        observacoes: record.OBSERVACOES || null,
        responsavel: record.RESPONSAVEL || null,
      };

      try {
        await db.insert(avarias)
          .values(novaAvaria)
          .onConflictDoUpdate({
            target: avarias.sheetId,
            set: novaAvaria
          });
        inserted++;
      } catch (err) {
        this.log("warn", `Aviso ao fazer upsert da avaria SKU ${record.REF}: ${err}`);
      }
    }

    return { log: `Avarias sincronizadas: ${inserted} registros importados.`, count: inserted };
  }

  private async syncDemandas(db: any, sheetsUrl: string): Promise<{ log: string; count: number }> {
    this.log("info", "Buscando aba de Demandas...");
    const data = await fetchLiveGoogleSheet(sheetsUrl, "demandas");

    let inserted = 0;
    for (const record of data as any[]) {
      if (!record.referencia) continue;

      if (!record.sheetId) {
        this.log("warn", `Linha ignorada em Demandas por falta de ID_DEMANDA (Ref: ${record.referencia})`);
        continue;
      }

      await this.ensureProductExists(db, record.referencia, "Produto importado via Demandas");

      const novaDemanda = {
        sheetId: record.sheetId,
        data: record.data || null,
        contato: record.contato || null,
        produtoSku: record.referencia,
        status: record.status || null,
        quantidade: record.quantidade || 1,
        threadId: record.threadId || null,
      };

      try {
        await db.insert(demandas)
          .values(novaDemanda)
          .onConflictDoUpdate({
            target: demandas.sheetId,
            set: novaDemanda
          });
        inserted++;
      } catch (err) {
        this.log("warn", `Aviso ao fazer upsert de demanda SKU ${record.referencia}: ${err}`);
      }
    }

    return { log: `Demandas sincronizadas: ${inserted} registros importados.`, count: inserted };
  }

  private async syncRecebimentos(db: any, sheetsUrl: string): Promise<{ log: string; count: number }> {
    this.log("info", "Buscando aba de Recebimentos...");
    const data = await fetchLiveGoogleSheet(sheetsUrl, "recebimento");

    let inserted = 0;
    for (const record of data as any[]) {
      if (!record.produtoSku) continue;

      if (!record.sheetId) {
        this.log("warn", `Linha ignorada em Recebimentos por falta de ID_RECEBIMENTO (Ref: ${record.produtoSku})`);
        continue;
      }

      await this.ensureProductExists(db, record.produtoSku, record.descricao || "Produto importado via Recebimentos");

      const novoRecebimento = {
        sheetId: record.sheetId,
        produtoSku: record.produtoSku,
        quantidade: record.quantidade || 1,
        qtdePorCaixa: record.qtdePorCaixa || 1,
        previsaoEntrega: record.previsaoEntrega || null,
        dataEntrega: record.dataEntrega || null,
        remetente: record.remetente || null,
        notaFiscal: record.notaFiscal || null,
        mundo: record.mundo || null,
        transportadora: record.transportadora || null,
        divergencia: record.divergencia || null,
        mes: record.mes || null,
        dataEmbarque: record.dataEmbarque || null,
        volumesCaixas: record.volumesCaixas || 0,
        valorDesconto: record.valorDesconto || null,
        descontoPromocional: record.descontoPromocional || null,
        acrescimoAdicional: record.acrescimoAdicional || null,
        precoItem: record.precoItem || null,
        subTotal: record.subTotal || null,
        orderStatus: record.dataEntrega ? "Chegou" : (record.previsaoEntrega ? "Previsto" : "Faturado"),
      };

      try {
        await db.insert(pedidosRastreio)
          .values(novoRecebimento)
          .onConflictDoUpdate({
            target: pedidosRastreio.sheetId,
            set: novoRecebimento
          });
        inserted++;
      } catch (err) {
        this.log("warn", `Aviso ao fazer upsert do recebimento SKU ${record.produtoSku}: ${err}`);
      }
    }

    return { log: `Recebimentos sincronizados: ${inserted} registros importados.`, count: inserted };
  }

  /**
   * Garante que o produto existe antes de inserir registros que o referenciam.
   */
  private async ensureProductExists(db: any, sku: string, descricao: string): Promise<void> {
    const existing = await db.select().from(produtos).where(eq(produtos.sku, sku));
    if (existing.length === 0) {
      await db.insert(produtos).values({ sku, descricao });
    }
  }
}
