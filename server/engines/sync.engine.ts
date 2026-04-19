/**
 * server/engines/sync.engine.ts
 */

import { eq, like } from "drizzle-orm";
import { google } from "googleapis";
import { 
  insertPedidoRastreio, 
  updatePedidoRastreio, 
  upsertProduto, 
  getDb, 
  saveGoogleSheetsConfig 
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
  qtdePorCaixa: number;
  descricao: string;
  previsao: Date | null;
  entrega: Date | null;
  remetente: string | null;
  notaFiscal: string | null;
  mundo: string | null;
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

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr || dateStr.toString().trim() === "") return null;
  const str = dateStr.toString().trim();
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const yearPart = parts[2].split(" ")[0];
      const year = yearPart.length === 2 ? 2000 + parseInt(yearPart, 10) : parseInt(yearPart, 10);
      return new Date(year, month, day, 12, 0, 0);
    }
  }
  const date = new Date(str);
  if (!isNaN(date.getTime())) return date;
  return null;
}

function getGoogleAuth() {
  const client_email = process.env.GOOGLE_SERVICE_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!client_email || !private_key) throw new Error("Credenciais do Google ausentes.");
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
  if (!db) { result.erros.push("BD indisponível"); return result; }
  
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) { result.erros.push("URL inválida"); return result; }

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const fileName = spreadsheet.data.properties?.title || "Arquivo Google Sheets";
    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title;

    await saveGoogleSheetsConfig(sheetsUrl, 1, fileName);

    if (!firstSheetName) throw new Error("Página da planilha não encontrada.");
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: firstSheetName });
    const rows = response.data.values;
    if (!rows || rows.length === 0) { result.erros.push("Planilha vazia"); return result; }

    let headerRowIndex = -1;
    let idxSku = -1, idxVolumes = -1, idxQtdePorCaixa = -1, idxDescricao = -1;
    let idxPrevisao = -1, idxEntrega = -1, idxRemetente = -1, idxNota = -1, idxMundo = -1;

    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const currentHeaders = rows[i].map((h: any) => 
        h ? h.toString().toUpperCase().replace(/["'\n]/g, " ").replace(/\s+/g, " ").trim() : ""
      );
      
      const tempSku = currentHeaders.findIndex((h: string) => h === "REF." || h === "REF");
      const tempVol = currentHeaders.findIndex((h: string) => h === "VOLUMES");
      const tempQtdeCaixa = currentHeaders.findIndex((h: string) => h.includes("QTDE") && h.includes("CAIXA"));

      if (tempSku !== -1 && tempVol !== -1) {
        headerRowIndex = i;
        idxSku = tempSku;
        idxVolumes = tempVol;
        idxQtdePorCaixa = tempQtdeCaixa;
        idxDescricao = currentHeaders.findIndex((h: string) => h.includes("DESCRIÇÃO") || h.includes("DESCRICAO"));
        idxRemetente = currentHeaders.findIndex((h: string) => h.includes("REMETENTE"));
        idxNota = currentHeaders.findIndex((h: string) => h.includes("NOTA FISCAL"));
        idxPrevisao = currentHeaders.findIndex((h: string) => h.includes("PREVISÃO") || h.includes("PREVISAO"));
        idxEntrega = currentHeaders.findIndex((h: string) => h.includes("DATA DE ENTREGA") || h === "ENTREGA");
        idxMundo = currentHeaders.findIndex((h: string) => h.includes("MUNDO"));
        break; 
      }
    }

    if (headerRowIndex === -1) {
      result.erros.push("Cabeçalho não encontrado. Verifique as colunas REF. e VOLUMES.");
      return result;
    }

    // ⚡ OTIMIZAÇÃO 1: Puxa todo o banco de dados de uma vez só! (1 requisição)
    const todosPedidosDB = await db.select().from(pedidosRastreio);
    
    const validDbIds = new Set<number>();
    const processedSkus = new Set<string>(); // Para não atualizar o mesmo produto várias vezes atoa

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const rowData = rows[i];
      if (!rowData || rowData.length === 0) continue;

      const sku = rowData[idxSku]?.toString().trim();
      const volumes = parseInt(rowData[idxVolumes]?.toString().replace(/\D/g, "") || "0", 10);
      const rawQtdeCaixa = rowData[idxQtdePorCaixa]?.toString().replace(/\D/g, "");
      const qtdePorCaixa = rawQtdeCaixa ? parseInt(rawQtdeCaixa, 10) : 1;

      if (!sku || isNaN(volumes) || volumes <= 0) continue;

      const row: ParsedRow = {
        sku,
        volumes,
        qtdePorCaixa,
        descricao: idxDescricao !== -1 ? rowData[idxDescricao]?.toString().trim() || "Sem descrição" : "Sem descrição",
        previsao: idxPrevisao !== -1 ? parseDate(rowData[idxPrevisao]) : null,
        entrega: idxEntrega !== -1 ? parseDate(rowData[idxEntrega]) : null,
        remetente: idxRemetente !== -1 ? rowData[idxRemetente]?.toString().trim() : null,
        notaFiscal: idxNota !== -1 ? rowData[idxNota]?.toString().trim() : null,
        mundo: idxMundo !== -1 ? rowData[idxMundo]?.toString().trim() : null,
      };

      try {
        // ⚡ OTIMIZAÇÃO 2: Só insere a descrição do produto uma vez por sincronização
        if (!processedSkus.has(row.sku)) {
          await upsertProduto({ sku: row.sku, descricao: row.descricao });
          processedSkus.add(row.sku);
        }

        const orderStatus = resolveOrderStatus(row.previsao, row.entrega);

        // ⚡ OTIMIZAÇÃO 3: Procura NA MEMÓRIA em vez de ir ao banco de dados!
        const existing = todosPedidosDB.find(
          (p) => p.produtoSku === row.sku && 
                 p.quantidade === row.volumes && 
                 p.notaFiscal === row.notaFiscal && 
                 !validDbIds.has(p.id)
        );

        if (!existing) {
          const inserted = await db.insert(pedidosRastreio).values({
            produtoSku: row.sku, quantidade: row.volumes, qtdePorCaixa: row.qtdePorCaixa,
            previsaoEntrega: row.previsao, dataEntrega: row.entrega, orderStatus,
            notificationSentStatus: pendingStatusFor(orderStatus), remetente: row.remetente,
            notaFiscal: row.notaFiscal, mundo: row.mundo, consultorId: 1, clienteId: 1,   
          }).returning({ id: pedidosRastreio.id });
          
          validDbIds.add(inserted[0].id);
          result.novosPedidos++;
        } else {
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

          await updatePedidoRastreio(existing.id, {
            quantidade: row.volumes, qtdePorCaixa: row.qtdePorCaixa, previsaoEntrega: row.previsao,
            dataEntrega: row.entrega, orderStatus, notificationSentStatus: transitioned ? updatedStatus : existing.notificationSentStatus,
            remetente: row.remetente, notaFiscal: row.notaFiscal, mundo: row.mundo,
          });

          validDbIds.add(existing.id);
        }
      } catch (dbError) {
        console.error(`Erro ao processar SKU ${sku}:`, dbError);
      }
    }

    // HORA DA LIMPEZA DOS FANTASMAS
    let fantasmasApagados = 0;
    for (const dbRow of todosPedidosDB) {
      if (!validDbIds.has(dbRow.id)) {
        await db.delete(pedidosRastreio).where(eq(pedidosRastreio.id, dbRow.id));
        fantasmasApagados++;
      }
    }
    
    console.log(`[Sync] Planilha lida com sucesso. Fantasmas deletados: ${fantasmasApagados}`);

  } catch (error: any) {
    console.error("Erro na API:", error);
    result.erros.push(`Falha ao ler planilha: ${error.message}`);
  }
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

// Adicione isto no final do ficheiro server/engines/sync.engine.ts

export async function fetchLiveGoogleSheet(sheetsUrl: string) {
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL da planilha inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title;

  if (!firstSheetName) throw new Error("Página da planilha não encontrada.");
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: firstSheetName });
  const rows = response.data.values;
  
  if (!rows || rows.length === 0) return [];

  let headerRowIndex = -1;
  let idxSku = -1, idxVolumes = -1, idxQtdePorCaixa = -1, idxDescricao = -1;
  let idxPrevisao = -1, idxEntrega = -1, idxRemetente = -1, idxNota = -1, idxMundo = -1;

  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const currentHeaders = rows[i].map((h: any) => h ? h.toString().toUpperCase().replace(/["'\n]/g, " ").replace(/\s+/g, " ").trim() : "");
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

  if (headerRowIndex === -1) throw new Error("Cabeçalho não encontrado.");

  const liveData = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const rowData = rows[i];
    if (!rowData || rowData.length === 0) continue;

    const sku = rowData[idxSku]?.toString().trim();
    const volumes = parseInt(rowData[idxVolumes]?.toString().replace(/\D/g, "") || "0", 10);
    const rawQtdeCaixa = rowData[idxQtdePorCaixa]?.toString().replace(/\D/g, "");
    const qtdePorCaixa = rawQtdeCaixa ? parseInt(rawQtdeCaixa, 10) : 1;

    if (!sku || isNaN(volumes) || volumes <= 0) continue;

    // Constrói o objeto perfeitamente formatado para a tela ler instantaneamente
    liveData.push({
      produtoSku: sku,
      quantidade: volumes,
      qtdePorCaixa: qtdePorCaixa,
      descricao: idxDescricao !== -1 ? rowData[idxDescricao]?.toString().trim() || "Sem descrição" : "Sem descrição",
      previsaoEntrega: idxPrevisao !== -1 ? parseDate(rowData[idxPrevisao])?.toISOString() : null,
      dataEntrega: idxEntrega !== -1 ? parseDate(rowData[idxEntrega])?.toISOString() : null,
      remetente: idxRemetente !== -1 ? rowData[idxRemetente]?.toString().trim() : null,
      notaFiscal: idxNota !== -1 ? rowData[idxNota]?.toString().trim() : null,
      mundo: idxMundo !== -1 ? rowData[idxMundo]?.toString().trim() : null,
    });
  }
  
  return liveData;
}