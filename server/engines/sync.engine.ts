/**
 * server/engines/sync.engine.ts
 */

import { eq, like } from "drizzle-orm";
import { google } from "googleapis";
import { 
  insertPedidoRastreio, updatePedidoRastreio, upsertProduto, 
  getDb, saveGoogleSheetsConfig 
} from "../db";
import { pedidosRastreio, produtos } from "../../drizzle/schema";
import type { OrderStatus, NotificationStatus } from "../../drizzle/schema";

export interface SyncResult { novosPedidos: number; novasPrevisoes: number; chegadas: number; erros: string[]; }

const sheetsCache: Record<string, { data: any[]; timestamp: number }> = {};
const CACHE_TTL_MS = 30 * 1000;

function getGoogleAuth() {
  const client_email = process.env.GOOGLE_SERVICE_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!client_email || !private_key) throw new Error("Credenciais do Google ausentes.");
  return new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// 🧠 NOVA INTELIGÊNCIA: Descobre qual é a aba exata olhando para o GID do link
function getSheetNameFromUrl(url: string, spreadsheet: any): string {
  const match = String(url).match(/[#&]gid=([0-9]+)/);
  const gid = match ? parseInt(match[1], 10) : null;
  
  if (gid !== null) {
    const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.sheetId === gid);
    if (sheet && sheet.properties?.title) return sheet.properties.title;
  }
  return spreadsheet.data.sheets?.[0]?.properties?.title || "Página1";
}

function parseDateSafe(dateVal: any): Date | null {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  if (!str || str === "" || str === "-") return null;
  try {
    if (str.includes("/")) {
      const parts = str.split("/");
      return new Date(parseInt(parts[2]?.split(" ")[0] || "0", 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 12, 0, 0);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

function resolveOrderStatus(previsao: Date | null, entrega: Date | null): OrderStatus {
  if (entrega) return "Chegou";
  if (previsao) return "Previsto";
  return "Faturado";
}

function pendingStatusFor(status: OrderStatus): NotificationStatus {
  const map: Record<OrderStatus, NotificationStatus> = { Faturado: "PENDING_FATURADO", Previsto: "PENDING_PREVISTO", Chegou: "PENDING_CHEGOU" };
  return map[status];
}

// 🚀 LEITURA INTELIGENTE SOB DEMANDA
export async function fetchLiveGoogleSheet(sheetsUrl: string) {
  if (!sheetsUrl) throw new Error("URL não fornecida.");
  const now = Date.now();
  if (sheetsCache[sheetsUrl] && (now - sheetsCache[sheetsUrl].timestamp < CACHE_TTL_MS)) {
    return sheetsCache[sheetsUrl].data;
  }

  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL da planilha inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
  const targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet); // Pega a aba certa!

  const response = await sheets.spreadsheets.values.get({ 
    spreadsheetId: spreadsheetId as string, 
    range: targetSheetName 
  });
  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  // 🧠 NOVA INTELIGÊNCIA: Escaneia até a linha 10 para achar o verdadeiro cabeçalho
  let headerRowIndex = 0;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const currentHeaders = rows[i].map((h: any) => String(h || "").toUpperCase().trim());
    // Se a linha tem uma dessas palavras, achamos o cabeçalho!
    if (currentHeaders.includes("CÓD. AVARIA") || currentHeaders.includes("REF.") || currentHeaders.includes("FÁBRICA")) {
      headerRowIndex = i;
      headers = currentHeaders;
      break;
    }
  }

  if (headers.length === 0) {
    headers = rows[0].map((h: any) => String(h || "").toUpperCase().trim());
  }
  
  const data = rows.slice(headerRowIndex + 1).map((row, index) => {
    const obj: any = { rowNumber: headerRowIndex + index + 2 };

    headers.forEach((header, idx) => {
      let val = row[idx] || "";
      const key = header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_");
      obj[key] = val;
    });

    if (obj.REF_) obj.produtoSku = String(obj.REF_).trim();
    if (obj.VOLUMES) obj.quantidade = parseInt(String(obj.VOLUMES).replace(/\D/g, ""), 10) || 0;

    return obj;
  });

  // Remove linhas totalmente vazias (caso você tenha linhas em branco no meio ou no fim da planilha)
  const dadosValidos = data.filter((d: any) => d.COD__AVARIA || d.REF_ || d.FABRICA);

  sheetsCache[sheetsUrl] = { data: dadosValidos, timestamp: Date.now() };
  return dadosValidos;
}

// ✍️ ADICIONAR E EDITAR (Atualizados para respeitar a Aba correta)
export async function addRowToSheet(sheetsUrl: string, rowData: any[]) {
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
  const targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);

  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId as string,
    range: `'${targetSheetName}'!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rowData] },
  });

  delete sheetsCache[sheetsUrl];
  return { success: true };
}

export async function updateSheetRow(sheetsUrl: string, rowNumber: number, columnLetter: string, newValue: string) {
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
  const targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);

  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId as string,
    range: `'${targetSheetName}'!${columnLetter}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[newValue]] },
  });

  delete sheetsCache[sheetsUrl];
  return { success: true };
}

// ... as funções antigas mantêm-se iguais abaixo
export async function syncPedidosFromGoogleSheets(sheetsUrl: string): Promise<SyncResult> {
  const result: SyncResult = { novosPedidos: 0, novasPrevisoes: 0, chegadas: 0, erros: [] };
  const db = await getDb();
  if (!db) return result;
  
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) return result;

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title;

    await saveGoogleSheetsConfig(sheetsUrl, 1, "Arquivo Antigo");

    if (!firstSheetName) return result;
    
    const response = await sheets.spreadsheets.values.get({ 
      spreadsheetId: spreadsheetId as string, 
      range: firstSheetName 
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) return result;

    let headerRowIndex = -1;
    let idxSku = -1, idxVolumes = -1, idxQtdePorCaixa = -1, idxDescricao = -1;
    let idxPrevisao = -1, idxEntrega = -1, idxRemetente = -1, idxNota = -1, idxMundo = -1;

    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const currentHeaders = rows[i].map((h: any) => h ? String(h).toUpperCase().replace(/["'\n]/g, " ").replace(/\s+/g, " ").trim() : "");
      const tempSku = currentHeaders.findIndex((h: string) => h === "REF." || h === "REF");
      const tempVol = currentHeaders.findIndex((h: string) => h === "VOLUMES");
      const tempQtdeCaixa = currentHeaders.findIndex((h: string) => h.includes("QTDE") && h.includes("CAIXA"));

      if (tempSku !== -1 && tempVol !== -1) {
        headerRowIndex = i;
        idxSku = tempSku; idxVolumes = tempVol; idxQtdePorCaixa = tempQtdeCaixa;
        idxDescricao = currentHeaders.findIndex((h: string) => h.includes("DESCRIÇÃO") || h.includes("DESCRICAO"));
        idxRemetente = currentHeaders.findIndex((h: string) => h.includes("REMETENTE"));
        idxNota = currentHeaders.findIndex((h: string) => h.includes("NOTA FISCAL"));
        idxPrevisao = currentHeaders.findIndex((h: string) => h.includes("PREVISÃO") || h.includes("PREVISAO"));
        idxEntrega = currentHeaders.findIndex((h: string) => h.includes("DATA DE ENTREGA") || h === "ENTREGA");
        idxMundo = currentHeaders.findIndex((h: string) => h.includes("MUNDO"));
        break; 
      }
    }

    if (headerRowIndex === -1) return result;

    const todosPedidosDB = await db.select().from(pedidosRastreio);
    const validDbIds = new Set<number>();
    const processedSkus = new Set<string>();

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const rowData = rows[i];
      if (!rowData || rowData.length === 0) continue;

      const sku = rowData[idxSku] ? String(rowData[idxSku]).trim() : "";
      const volumes = parseInt(rowData[idxVolumes] ? String(rowData[idxVolumes]).replace(/\D/g, "") : "0", 10);
      const qtdePorCaixa = parseInt(rowData[idxQtdePorCaixa] ? String(rowData[idxQtdePorCaixa]).replace(/\D/g, "") : "1", 10);

      if (!sku || isNaN(volumes) || volumes <= 0) continue;

      const descricao = idxDescricao !== -1 && rowData[idxDescricao] ? String(rowData[idxDescricao]).trim() : "Sem descrição";
      const previsao = idxPrevisao !== -1 ? parseDateSafe(rowData[idxPrevisao]) : null;
      const entrega = idxEntrega !== -1 ? parseDateSafe(rowData[idxEntrega]) : null;
      const remetente = idxRemetente !== -1 && rowData[idxRemetente] ? String(rowData[idxRemetente]).trim() : null;
      const notaFiscal = idxNota !== -1 && rowData[idxNota] ? String(rowData[idxNota]).trim() : null;
      const mundo = idxMundo !== -1 && rowData[idxMundo] ? String(rowData[idxMundo]).trim() : null;

      try {
        if (!processedSkus.has(sku)) { await upsertProduto({ sku, descricao }); processedSkus.add(sku); }
        const orderStatus = resolveOrderStatus(previsao, entrega);
        const existing = todosPedidosDB.find(p => p.produtoSku === sku && p.quantidade === volumes && p.notaFiscal === notaFiscal && !validDbIds.has(p.id));

        if (!existing) {
          const inserted = await db.insert(pedidosRastreio).values({
            produtoSku: sku, quantidade: volumes, qtdePorCaixa, previsaoEntrega: previsao, dataEntrega: entrega, orderStatus,
            notificationSentStatus: pendingStatusFor(orderStatus), remetente, notaFiscal, mundo, consultorId: 1, clienteId: 1,   
          }).returning({ id: pedidosRastreio.id });
          validDbIds.add(inserted[0].id);
          result.novosPedidos++;
        } else { validDbIds.add(existing.id); }
      } catch (dbError) {}
    }
  } catch (error: any) { result.erros.push(`Falha: ${error.message}`); }
  return result;
}

export async function getAllPedidosWithDescricao() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select({
        id: pedidosRastreio.id, produtoSku: pedidosRastreio.produtoSku, quantidade: pedidosRastreio.quantidade,
        qtdePorCaixa: pedidosRastreio.qtdePorCaixa, previsaoEntrega: pedidosRastreio.previsaoEntrega,
        dataEntrega: pedidosRastreio.dataEntrega, orderStatus: pedidosRastreio.orderStatus,
        notificationSentStatus: pedidosRastreio.notificationSentStatus, remetente: pedidosRastreio.remetente,
        notaFiscal: pedidosRastreio.notaFiscal, mundo: pedidosRastreio.mundo,
        consultorId: pedidosRastreio.consultorId, clienteId: pedidosRastreio.clienteId,
        descricao: produtos.descricao,
      }).from(pedidosRastreio).leftJoin(produtos, eq(pedidosRastreio.produtoSku, produtos.sku));
  } catch (error) { return []; }
}

export async function getPendingNotifications() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select({
        id: pedidosRastreio.id, produtoSku: pedidosRastreio.produtoSku, quantidade: pedidosRastreio.quantidade,
        qtdePorCaixa: pedidosRastreio.qtdePorCaixa, previsaoEntrega: pedidosRastreio.previsaoEntrega,
        dataEntrega: pedidosRastreio.dataEntrega, orderStatus: pedidosRastreio.orderStatus,
        notificationSentStatus: pedidosRastreio.notificationSentStatus, remetente: pedidosRastreio.remetente,
        notaFiscal: pedidosRastreio.notaFiscal, mundo: pedidosRastreio.mundo,
        consultorId: pedidosRastreio.consultorId, clienteId: pedidosRastreio.clienteId,
        descricao: produtos.descricao,
      }).from(pedidosRastreio).leftJoin(produtos, eq(pedidosRastreio.produtoSku, produtos.sku))
      .where(like(pedidosRastreio.notificationSentStatus, "PENDING_%"));
  } catch (error) { return []; }
}

export async function updateNotificationStatus(pedidoId: number, newStatus: string): Promise<boolean> {
  try { await updatePedidoRastreio(pedidoId, { notificationSentStatus: newStatus }); return true; } 
  catch (error) { return false; }
}
export async function testarLeituraRobo(url: string) { return {}; }