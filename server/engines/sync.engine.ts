/**
 * server/engines/sync.engine.ts
 *
 * Motor de sincronização de pedidos.
 * Responsável por processar dados do Google Sheets e atualizar o banco.
 */

import { eq, like } from "drizzle-orm";
import { google } from "googleapis";
import {
  insertPedidoRastreio,
  updatePedidoRastreio,
  upsertProduto,
  getDb,
} from "../db";
import { pedidosRastreio, produtos } from "../../drizzle/schema";
import type { OrderStatus, NotificationStatus } from "../../drizzle/schema";

export interface SyncResult {
  novosPedidos: number;
  novasPrevisoes: number;
  chegadas: number;
  erros: string[];
}

interface ParsedRow {
  sku: string;
  volumes: number;
  descricao: string;
  previsao: Date | null;
  entrega: Date | null;
}

function resolveOrderStatus(previsao: Date | null, entrega: Date | null): OrderStatus {
  if (entrega) return "Chegou";
  if (previsao) return "Previsto";
  return "Faturado";
}

function pendingStatusFor(status: OrderStatus): NotificationStatus {
  const map: Record<OrderStatus, NotificationStatus> = {
    Faturado: "PENDING_FATURADO",
    Previsto: "PENDING_PREVISTO",
    Chegou: "PENDING_CHEGOU",
  };
  return map[status];
}

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
  }
  return null;
}

function getGoogleAuth() {
  const client_email = process.env.GOOGLE_SERVICE_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!client_email || !private_key) {
    throw new Error("Credenciais do Google ausentes no ambiente do Render.");
  }

  return new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export async function syncPedidosFromGoogleSheets(sheetsUrl: string): Promise<SyncResult> {
  const result: SyncResult = { novosPedidos: 0, novasPrevisoes: 0, chegadas: 0, erros: [] };

  const db = await getDb();
  if (!db) {
    result.erros.push("Banco de dados indisponível.");
    return result;
  }

  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) {
    result.erros.push("URL do Google Sheets inválida.");
    return result;
  }

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title;

    if (!firstSheetName) throw new Error("Página da planilha não encontrada.");

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: firstSheetName });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      result.erros.push("A planilha está vazia.");
      return result;
    }

    const headers = rows[0].map(h => h.toString().toUpperCase().replace(/\n/g, " ").trim());
    
    const idxSku = headers.findIndex(h => h.includes("REF.") || h === "REF" || h === "SKU");
    const idxVolumes = headers.findIndex(h => h.includes("VOLUMES") || h.includes("QTDE"));
    const idxDescricao = headers.findIndex(h => h.includes("DESCRIÇÃO") || h.includes("DESCRICAO"));
    const idxPrevisao = headers.findIndex(h => h.includes("PREVISÃO") || h.includes("PREVISAO"));
    const idxEntrega = headers.findIndex(h => h.includes("ENTREGA") && !h.includes("PREVISÃO"));

    if (idxSku === -1 || idxVolumes === -1) {
      result.erros.push("Colunas 'REF.' ou 'VOLUMES' não encontradas.");
      return result;
    }

    for (let i = 1; i < rows.length; i++) {
      const rowData = rows[i];
      const sku = rowData[idxSku]?.trim();
      const volumes = parseInt(rowData[idxVolumes], 10);

      if (!sku || isNaN(volumes) || volumes <= 0) continue;

      const row: ParsedRow = {
        sku,
        volumes,
        descricao: idxDescricao !== -1 ? rowData[idxDescricao]?.trim() || "Sem descrição" : "Sem descrição",
        previsao: idxPrevisao !== -1 ? parseDate(rowData[idxPrevisao]) : null,
        entrega: idxEntrega !== -1 ? parseDate(rowData[idxEntrega]) : null,
      };

      try {
        await upsertProduto({ sku: row.sku, descricao: row.descricao });
        const orderStatus = resolveOrderStatus(row.previsao, row.entrega);

        const existingRows = await db.select().from(pedidosRastreio).where(eq(pedidosRastreio.produtoSku, row.sku));
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

        const hadEntrega = !!existing.dataEntrega;
        const hadPrevisao = !!existing.previsaoEntrega;
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
      } catch (dbError) {
        console.error(`Erro ao processar SKU ${sku}:`, dbError);
      }
    }
  } catch (error: any) {
    console.error("Erro na API do Google Sheets:", error);
    result.erros.push(`Falha de comunicação: ${error.message}`);
  }
  return result;
}

export async function getPendingNotifications() {
  const db = await getDb();
  if (!db) return [];
  try {
    // ⚠️ Correção: 'await' para evitar quebra do servidor, e 'leftJoin' para trazer as descrições dos produtos!
    const results = await db
      .select({
        id: pedidosRastreio.id,
        produtoSku: pedidosRastreio.produtoSku,
        quantidade: pedidosRastreio.quantidade,
        previsaoEntrega: pedidosRastreio.previsaoEntrega,
        dataEntrega: pedidosRastreio.dataEntrega,
        orderStatus: pedidosRastreio.orderStatus,
        notificationSentStatus: pedidosRastreio.notificationSentStatus,
        consultorId: pedidosRastreio.consultorId,
        clienteId: pedidosRastreio.clienteId,
        descricao: produtos.descricao,
      })
      .from(pedidosRastreio)
      .leftJoin(produtos, eq(pedidosRastreio.produtoSku, produtos.sku))
      .where(like(pedidosRastreio.notificationSentStatus, "PENDING_%"));

    return results;
  } catch (error) {
    console.error("[SyncEngine] Erro ao buscar notificações:", error);
    return [];
  }
}

export async function updateNotificationStatus(pedidoId: number, newStatus: string): Promise<boolean> {
  try {
    await updatePedidoRastreio(pedidoId, { notificationSentStatus: newStatus });
    return true;
  } catch (error) {
    console.error("[SyncEngine] Erro ao atualizar status:", error);
    return false;
  }
}