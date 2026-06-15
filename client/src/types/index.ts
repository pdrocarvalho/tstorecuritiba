/**
 * client/src/types/index.ts
 *
 * Tipos compartilhados no lado do cliente.
 * Evita repetição de interfaces em múltiplos componentes.
 */

// =============================================================================
// PEDIDOS
// =============================================================================

export type OrderStatus = "Faturado" | "Previsto" | "Chegou";

export interface Pedido {
  id: number;
  produtoSku: string;
  descricao: string;
  quantidade: number;
  qtdePorCaixa?: number;
  previsaoEntrega: string | null;
  dataEntrega: string | null;
  orderStatus: OrderStatus;
  notificationSentStatus: string;
  /** Campos do Excel que vêm como metadados extras */
  remetente?: string;
  notaFiscal?: string;
  mundo?: string;
  transportadora?: string;
  divergencia?: string;
  mes?: string;
  volumesCaixas?: number;
  dataEmbarque?: string | null;
  consultorId?: number | null;
  clienteId?: number | null;
}

// =============================================================================
// FILTROS
// =============================================================================

export interface ProdutosFiltros {
  remetente: string;
  mundo: string;
  status: OrderStatus | "";
}

// =============================================================================
// KPIs
// =============================================================================

export interface VolumeporFabrica {
  nome: string;
  volume: number;
}

export interface DiversidadePorMundo {
  mundo: string;
  totalRefs: number;
}

export interface KpiStats {
  totalProdutos: number;
  totalVolume: number;
  totalFabricas: number;
  totalMundos: number;
}

// =============================================================================
// SYNC
// =============================================================================

export interface SyncResult {
  novosPedidos: number;
  novasPrevisoes: number;
  chegadas: number;
}

// =============================================================================
// AVARIAS
// =============================================================================

export interface Avaria {
  rowNumber?: number;
  COD_AVARIA?: string;
  REF?: string;
  DESCRICAO?: string;
  QTDE?: string | number;
  STATUS?: string;
  TRATATIVA?: string;
  FABRICA?: string;
  OK_STATUS?: string;
  DATA_DA_COLETA?: string;
  NOTA_FISCAL_DE_SAIDA?: string;
  NOTA_FISCAL_DE_REPOSICAO?: string;
  FOI_LANCADO_NO_SISTEMA?: string;
  CONSTA_FISICAMENTE?: string;
  MOTIVO?: string;
  DATA_DE_ENTRADA?: string;
  NOTA_FISCAL_DE_ENTRADA?: string;
  CUPOM_FISCAL?: string;
  OBSERVACOES?: string;
}

// =============================================================================
// DEMANDAS
// =============================================================================

export interface Demanda {
  rowNumber?: number;
  data?: string;
  consultor?: string;
  cliente?: string;
  contato?: string;
  referencia?: string;
  status?: string;
}
