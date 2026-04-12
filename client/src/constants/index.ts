/**
 * client/src/constants/index.ts
 *
 * Dicionário central de todas as rotas (URLs) da aplicação.
 */

export const ROUTES = {
  home: "/",
  recebimento: {
    produtos: "/recebimento/produtos",     // Aba: Recebimento Futuro
    historico: "/recebimento/historico",   // Aba: Histórico de Entregas
    config: "/recebimento/config",         // Aba: Configurações
  },
} as const;