/**
 * client/src/constants/index.ts
 *
 * Constantes da aplicação.
 * Centraliza valores que não devem estar espalhados pelo código.
 */

import type { OrderStatus } from "../types";

// =============================================================================
// LABELS E CORES POR STATUS
// =============================================================================

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  Faturado: "Faturado",
  Previsto: "Previsto",
  Chegou: "Chegou",
};

/** Classes Tailwind para badge de status. */
export const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  Faturado: "bg-blue-100 text-blue-800",
  Previsto: "bg-orange-100 text-orange-800",
  Chegou: "bg-green-100 text-green-800",
};

/** Cor primária para gráficos/KPIs por status. */
export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  Faturado: "text-blue-600",
  Previsto: "text-orange-600",
  Chegou: "text-green-600",
};

// =============================================================================
// ROTAS
// =============================================================================

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  upload: "/upload",
  recebimento: {
    produtos: "/recebimento/produtos",
    kpis: "/recebimento/kpis",
    config: "/recebimento/config",
  },
} as const;

// =============================================================================
// LOCALIZAÇÃO
// =============================================================================

export const DATE_LOCALE = "pt-BR";
