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
  previsaoEntrega: string | null;
  dataEntrega: string | null;
  orderStatus: OrderStatus;
  notificationSentStatus: string;
  /** Campos do Excel que vêm como metadados extras */
  remetente?: string;
  notaFiscal?: string;
  mundo?: string;
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
