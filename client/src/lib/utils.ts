/**
 * client/src/lib/utils.ts
 *
 * Funções utilitárias puras do lado do cliente.
 */

import { DATE_LOCALE } from "../constants";

/**
 * Formata uma string ou Date para o padrão DD/MM/AAAA em pt-BR.
 * Retorna "—" se o valor for nulo/undefined/inválido.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";

  const date = typeof value === "string" ? new Date(value) : value;

  if (isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formata um número inteiro com separador de milhar para pt-BR.
 * Ex: 1234567 → "1.234.567"
 */
export function formatNumber(value: number): string {
  return value.toLocaleString(DATE_LOCALE);
}

/**
 * Calcula a porcentagem de `value` em relação a `total`.
 * Retorna 0 se total for 0 para evitar divisão por zero.
 */
export function calcPercent(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}
