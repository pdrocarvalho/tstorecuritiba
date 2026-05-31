/**
 * client/src/constants/index.ts
 *
 * Fonte única de verdade para constantes globais do frontend.
 * Importe daqui em vez de redefinir nos componentes.
 */

// =============================================================================
// ROTAS
// =============================================================================
export const ROUTES = {
  home: "/",
  recebimento: {
    produtos: "/recebimento/produtos",
    historico: "/recebimento/historico",
  },
  avarias: "/avarias",
};

// =============================================================================
// MUNDOS
// =============================================================================
export const MUNDOS_FIXOS = ["CORTAR", "EQUIPAR", "FESTEJAR", "PREPARAR", "SERVIR"] as const;

export const MUNDO_COLORS: Record<string, string> = {
  "CORTAR":   "#fca5a5",
  "EQUIPAR":  "#93c5fd",
  "FESTEJAR": "#c4b5fd",
  "PREPARAR": "#86efac",
  "SERVIR":   "#fde047",
};

// =============================================================================
// FÁBRICAS
// =============================================================================
export const FABRICAS_FIXAS = ["CUTELARIA", "FARROUPILHA", "CD SUL", "TEEC", "BELÉM", "DELTA"] as const;

export const FABRICAS_COM_PREFIXO = [
  { nome: "CUTELARIA",   prefixo: "CTL" },
  { nome: "FARROUPILHA", prefixo: "FRP" },
  { nome: "CD SUL",      prefixo: "CDS" },
  { nome: "TEEC",        prefixo: "TEC" },
  { nome: "BELÉM",       prefixo: "BLM" },
] as const;