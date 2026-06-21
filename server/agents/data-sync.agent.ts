import { getDb } from "../db";
import { fetchLiveGoogleSheet } from "../engines/sync.engine";
import { avarias, demandas, pedidosRastreio, produtos } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export class DataSyncAgent {
  /**
   * Executa a sincronização completa das planilhas para o Supabase.
   */
  static async runFullSync(urls: { avarias?: string; demandas?: string; recebimentos?: string }) {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados não disponível.");

    const logs: string[] = [];
    console.log("[DataSyncAgent] Iniciando sincronização manual...");

    try {
      if (urls.avarias) logs.push(await this.syncAvarias(db, urls.avarias));
      if (urls.demandas) logs.push(await this.syncDemandas(db, urls.demandas));
      if (urls.recebimentos) logs.push(await this.syncRecebimentos(db, urls.recebimentos));

      console.log("[DataSyncAgent] Sincronização concluída com sucesso.");
      return { success: true, logs };
    } catch (error: any) {
      console.error("[DataSyncAgent] Erro durante a sincronização:", error);
      return { success: false, error: error.message, logs };
    }
  }

  private static async syncAvarias(db: any, sheetsUrl: string) {
    console.log("[DataSyncAgent] Buscando aba de Avarias...");
    const data = await fetchLiveGoogleSheet(sheetsUrl, "avarias");
    
    let inserted = 0;
    for (const record of data as any[]) {
      if (!record.REF) continue; // Ignora linhas vazias

      // Garante que o produto existe para não quebrar a Foreign Key
      await this.ensureProductExists(db, record.REF, record.DESCRICAO || "Produto importado via Avarias");

      const novaAvaria = {
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
        await db.insert(avarias).values(novaAvaria);
        inserted++;
      } catch (err) {
        console.warn(`[DataSyncAgent] Aviso ao inserir avaria SKU ${record.REF}:`, err);
      }
    }
    return `Avarias sincronizadas: ${inserted} registros importados.`;
  }

  private static async syncDemandas(db: any, sheetsUrl: string) {
    console.log("[DataSyncAgent] Buscando aba de Demandas...");
    const data = await fetchLiveGoogleSheet(sheetsUrl, "demandas");
    
    let inserted = 0;
    for (const record of data as any[]) {
      if (!record.referencia) continue;

      await this.ensureProductExists(db, record.referencia, "Produto importado via Demandas");

      const novaDemanda = {
        data: record.data || null,
        contato: record.contato || null,
        produtoSku: record.referencia,
        status: record.status || null,
        quantidade: record.quantidade || 1,
        threadId: record.threadId || null,
      };

      try {
        await db.insert(demandas).values(novaDemanda);
        inserted++;
      } catch (err) {
        console.warn(`[DataSyncAgent] Aviso ao inserir demanda SKU ${record.referencia}:`, err);
      }
    }
    return `Demandas sincronizadas: ${inserted} registros importados.`;
  }

  private static async syncRecebimentos(db: any, sheetsUrl: string) {
    console.log("[DataSyncAgent] Buscando aba de Recebimentos...");
    const data = await fetchLiveGoogleSheet(sheetsUrl, "recebimento");
    
    let inserted = 0;
    for (const record of data as any[]) {
      if (!record.produtoSku) continue;

      await this.ensureProductExists(db, record.produtoSku, record.descricao || "Produto importado via Recebimentos");

      const novoRecebimento = {
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
        await db.insert(pedidosRastreio).values(novoRecebimento);
        inserted++;
      } catch (err) {
        console.warn(`[DataSyncAgent] Aviso ao inserir recebimento SKU ${record.produtoSku}:`, err);
      }
    }
    return `Recebimentos sincronizadas: ${inserted} registros importados.`;
  }

  /**
   * Helper para garantir que o produto existe antes de inserir o registro estrangeiro.
   */
  private static async ensureProductExists(db: any, sku: string, descricao: string) {
    const existing = await db.select().from(produtos).where(eq(produtos.sku, sku));
    if (existing.length === 0) {
      await db.insert(produtos).values({
        sku: sku,
        descricao: descricao,
      });
    }
  }
}
