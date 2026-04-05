/**
 * server/engines/sync.engine.ts
 *
 * Motor de sincronização de pedidos.
 * Responsável por processar dados do Excel/Google Sheets e atualizar o banco.
 *
 * Regra de Ouro:
 *   Sempre que um pedido muda de fase, seu status de notificação
 *   volta para PENDING_<FASE> para disparar novo e-mail.
 */

import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import {
  insertPedidoRastreio,
  updatePedidoRastreio,
  upsertProduto,
  getDb,
} from "../db";
import { pedidosRastreio } from "../../drizzle/schema";
import type { OrderStatus, NotificationStatus } from "../../drizzle/schema";

// =============================================================================
// TIPOS
// =============================================================================

export interface SyncResult {
  novosPedidos: number;
  novasPrevisoes: number;
  chegadas: number;
  erros: string[];
}

/** Linha mapeada do Excel após normalização. */
interface ExcelRow {
  sku: string;
  volumes: number;
  descricao: string;
  previsao: Date | null;
  entrega: Date | null;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Determina o OrderStatus com base nas datas disponíveis.
 * - Sem datas  → Faturado
 * - Com previsão, sem entrega → Previsto
 * - Com entrega → Chegou
 */
function resolveOrderStatus(
  previsao: Date | null,
  entrega: Date | null
): OrderStatus {
  if (entrega) return "Chegou";
  if (previsao) return "Previsto";
  return "Faturado";
}

/**
 * Resolve o NotificationStatus de PENDING para uma fase.
 */
function pendingStatusFor(status: OrderStatus): NotificationStatus {
  const map: Record<OrderStatus, NotificationStatus> = {
    Faturado: "PENDING_FATURADO",
    Previsto: "PENDING_PREVISTO",
    Chegou: "PENDING_CHEGOU",
  };
  return map[status];
}

/**
 * Normaliza uma linha bruta do Excel para o formato interno.
 * Retorna null se a linha for inválida (sem SKU ou quantidade zero).
 */
function parseExcelRow(raw: Record<string, unknown>): ExcelRow | null {
  const sku = String(raw["REF."] ?? "").trim();
  const volumes = parseInt(String(raw["VOLUMES"] ?? "0"), 10);

  if (!sku || volumes === 0) return null;

  return {
    sku,
    volumes,
    descricao: String(raw["DESCRICAO"] ?? "").trim(),
    previsao: raw["PREVISAO_ENTREGA"] ? new Date(String(raw["PREVISAO_ENTREGA"])) : null,
    entrega: raw["DATA_ENTREGA"] ? new Date(String(raw["DATA_ENTREGA"])) : null,
  };
}

// =============================================================================
// SINCRONIZAÇÃO VIA EXCEL
// =============================================================================

/**
 * Lê um arquivo Excel (Buffer) e sincroniza os pedidos com o banco de dados.
 * Para cada linha:
 *  - Se não existe → insere como novo pedido (PENDING_FATURADO).
 *  - Se existe e mudou de fase → atualiza status de notificação.
 */
export async function syncExcelWithDatabase(fileBuffer: Buffer): Promise<SyncResult> {
  const result: SyncResult = { novosPedidos: 0, novasPrevisoes: 0, chegadas: 0, erros: [] };

  const db = await getDb();
  if (!db) {
    result.erros.push("Banco de dados indisponível.");
    return result;
  }

  let rows: Record<string, unknown>[];

  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
  } catch (error) {
    result.erros.push(`Erro ao ler o arquivo Excel: ${error}`);
    return result;
  }

  for (const raw of rows) {
    try {
      const row = parseExcelRow(raw);
      if (!row) continue;

      await upsertProduto({ sku: row.sku, descricao: row.descricao });

      const orderStatus = resolveOrderStatus(row.previsao, row.entrega);

      const existingRows = await db
        .select()
        .from(pedidosRastreio)
        .where(eq(pedidosRastreio.produtoSku, row.sku));

      const existing = existingRows.find((p) => p.quantidade === row.volumes);

      if (!existing) {
        await insertPedidoRastreio({
          produtoSku: row.sku,
          quantidade: row.volumes,
          previsaoEntrega: row.previsao,
          dataEntrega: row.entrega,
          orderStatus,
          notificationSentStatus: pendingStatusFor(orderStatus),
          consultorId: 1,
          clienteId: 1,
        });
        result.novosPedidos++;
        continue;
      }

      // Detectar transição de fase (Regra de Ouro)
      const hadEntrega = !!existing.dataEntrega;
      const hadPrevisao = !!existing.previsaoEntrega;
      const newNotificationStatus = existing.notificationSentStatus;

      let transitioned = false;
      let updatedStatus = existing.notificationSentStatus;

      if (!hadEntrega && row.entrega) {
        updatedStatus = "PENDING_CHEGOU";
        result.chegadas++;
        transitioned = true;
      } else if (!hadPrevisao && row.previsao && !row.entrega) {
        updatedStatus = "PENDING_PREVISTO";
        result.novasPrevisoes++;
        transitioned = true;
      }

      if (transitioned) {
        await updatePedidoRastreio(existing.id, {
          previsaoEntrega: row.previsao,
          dataEntrega: row.entrega,
          orderStatus,
          notificationSentStatus: updatedStatus,
        });
      }
    } catch (error) {
      result.erros.push(`Erro ao processar linha SKU="${raw["REF."] ?? "?"}: ${error}`);
    }
  }

  return result;
}

// =============================================================================
// SINCRONIZAÇÃO VIA GOOGLE SHEETS
// =============================================================================

/**
 * Sincroniza dados a partir de uma URL do Google Sheets.
 * TODO: Implementar leitura real via Google Sheets API.
 */
export async function syncPedidosFromGoogleSheets(sheetsUrl: string): Promise<SyncResult> {
  const result: SyncResult = { novosPedidos: 0, novasPrevisoes: 0, chegadas: 0, erros: [] };

  console.log(`[SyncEngine] Iniciando sync do Google Sheets: ${sheetsUrl}`);
  // TODO: Integrar Google Sheets API aqui

  return result;
}

// =============================================================================
// NOTIFICAÇÕES PENDENTES
// =============================================================================

export async function getPendingNotifications() {
  const db = await getDb();
  if (!db) return [];

  try {
    const { like } = await import("drizzle-orm");
    return db
      .select()
      .from(pedidosRastreio)
      .where(like(pedidosRastreio.notificationSentStatus, "PENDING_%"));
  } catch (error) {
    console.error("[SyncEngine] Erro ao buscar notificações pendentes:", error);
    return [];
  }
}

export async function updateNotificationStatus(
  pedidoId: number,
  newStatus: string
): Promise<boolean> {
  try {
    await updatePedidoRastreio(pedidoId, { notificationSentStatus: newStatus });
    return true;
  } catch (error) {
    console.error("[SyncEngine] Erro ao atualizar status de notificação:", error);
    return false;
  }
}
