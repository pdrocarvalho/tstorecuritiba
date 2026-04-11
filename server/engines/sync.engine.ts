/**
 * server/engines/sync.engine.ts
 *
 * Motor de sincronização de pedidos com leitura inteligente do cabeçalho
 * e captura do nome do arquivo.
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

// Lida com várias formatações de data do Excel
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

    // 1. Descobrir os metadados da planilha (Título do arquivo)
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const fileName = spreadsheet.data.properties?.title || "Arquivo Google Sheets";
    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title;

    // Atualiza o nome do arquivo no nosso banco de dados automaticamente para o LED verde
    await saveGoogleSheetsConfig(sheetsUrl, 1, fileName);

    if (!firstSheetName) throw new Error("Página da planilha não encontrada.");

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: firstSheetName });
    const rows = response.data.values;
    
    if (!rows || rows.length === 0) {
      result.erros.push("A planilha está vazia.");
      return result;
    }

    // 2. Procura Inteligente do Cabeçalho (lê as primeiras 15 linhas)
    let headerRowIndex = -1;
    let idxSku = -1, idxVolumes = -1, idxDescricao = -1;
    let idxPrevisao = -1, idxEntrega = -1, idxRemetente = -1, idxNota = -1, idxMundo = -1;

    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      // Normaliza o texto removendo quebras de linha e espaços duplos
      const currentHeaders = rows[i].map((h: any) => h ? h.toString().toUpperCase().replace(/\n/g, " ").trim() : "");
      
      const tempSku = currentHeaders.findIndex((h: string) => h === "REF." || h === "REF" || h === "SKU" || h.includes("REFERÊNCIA"));
      
      // MÁGICA: Tem de ser exatamente "VOLUMES" para não confundir com a coluna "QTDE. POR CAIXA"
      const tempVol = currentHeaders.findIndex((h: string) => h === "VOLUMES");
      
      if (tempSku !== -1 && tempVol !== -1) {
        headerRowIndex = i;
        idxSku = tempSku;
        idxVolumes = tempVol;
        idxDescricao = currentHeaders.findIndex((h: string) => h.includes("DESCRIÇÃO") || h.includes("DESCRICAO"));
        idxPrevisao = currentHeaders.findIndex((h: string) => h.includes("PREVISÃO") || h.includes("PREVISAO"));
        idxEntrega = currentHeaders.findIndex((h: string) => h.includes("DATA DE ENTREGA") || h === "ENTREGA");
        idxRemetente = currentHeaders.findIndex((h: string) => h.includes("REMETENTE"));
        idxNota = currentHeaders.findIndex((h: string) => h.includes("NOTA FISCAL"));
        idxMundo = currentHeaders.findIndex((h: string) => h === "MUNDO");
        break; // Encontrou o cabeçalho, pára de procurar!
      }
    }

    if (headerRowIndex === -1) {
      result.erros.push("Cabeçalho não encontrado. Certifique-se que as colunas 'REF.' e 'VOLUMES' existem.");
      return result;
    }

    // 3. Processar apenas os dados reais (ignorando tudo acima do cabeçalho)
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const rowData = rows[i];
      if (!rowData || rowData.length === 0) continue;

      const sku = rowData[idxSku]?.toString().trim();
      
      // Remove letras e espaços da quantidade (ex: "10 cx" vira 10)
      const rawVolumes = rowData[idxVolumes]?.toString().replace(/\D/g, "");
      const volumes = rawVolumes ? parseInt(rawVolumes, 10) : 0;

      // Se não tiver SKU ou Volume, a linha é ignorada
      if (!sku || isNaN(volumes) || volumes <= 0) continue;

      const row: ParsedRow = {
        sku,
        volumes,
        descricao: idxDescricao !== -1 ? rowData[idxDescricao]?.toString().trim() || "Sem descrição" : "Sem descrição",
        previsao: idxPrevisao !== -1 ? parseDate(rowData[idxPrevisao]) : null,
        entrega: idxEntrega !== -1 ? parseDate(rowData[idxEntrega]) : null,
        remetente: idxRemetente !== -1 ? rowData[idxRemetente]?.toString().trim() : null,
        notaFiscal: idxNota !== -1 ? rowData[idxNota]?.toString().trim() : null,
        mundo: idxMundo !== -1 ? rowData[idxMundo]?.toString().trim() : null,
      };

      try {
        await upsertProduto({ sku: row.sku, descricao: row.descricao });
        const orderStatus = resolveOrderStatus(row.previsao, row.entrega);

        const existingRows = await db.select().from(pedidosRastreio).where(eq(pedidosRastreio.produtoSku, row.sku));
        // O volume atua como nosso "diferenciador" caso exista o mesmo SKU várias vezes
        const existing = existingRows.find((p) => p.quantidade === row.volumes);

        if (!existing) {
          // PRODUTO NOVO
          await insertPedidoRastreio({
            produtoSku: row.sku,
            quantidade: row.volumes,
            previsaoEntrega: row.previsao,
            dataEntrega: row.entrega,
            orderStatus,
            notificationSentStatus: pendingStatusFor(orderStatus),
            remetente: row.remetente,
            notaFiscal: row.notaFiscal,
            mundo: row.mundo,
            consultorId: 1, 
            clienteId: 1,   
          });
          result.novosPedidos++;
          continue;
        }

        // PRODUTO JÁ EXISTE: Vamos verificar se mudou de fase
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

        // Atualiza a base de dados com as informações mais recentes
        await updatePedidoRastreio(existing.id, {
          previsaoEntrega: row.previsao,
          dataEntrega: row.entrega,
          orderStatus,
          notificationSentStatus: transitioned ? updatedStatus : existing.notificationSentStatus,
          remetente: row.remetente,
          notaFiscal: row.notaFiscal,
          mundo: row.mundo,
        });

      } catch (dbError) {
        console.error(`Erro ao processar SKU ${sku}:`, dbError);
      }
    }
  } catch (error: any) {
    console.error("Erro na API do Google Sheets:", error);
    result.erros.push(`Falha ao ler planilha: ${error.message}`);
  }
  return result;
}

// Traz TODOS os pedidos para o Dashboard e Listagem funcionarem sempre (independente dos e-mails)
export async function getAllPedidosWithDescricao() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select({
        id: pedidosRastreio.id,
        produtoSku: pedidosRastreio.produtoSku,
        quantidade: pedidosRastreio.quantidade,
        previsaoEntrega: pedidosRastreio.previsaoEntrega,
        dataEntrega: pedidosRastreio.dataEntrega,
        orderStatus: pedidosRastreio.orderStatus,
        notificationSentStatus: pedidosRastreio.notificationSentStatus,
        remetente: pedidosRastreio.remetente,
        notaFiscal: pedidosRastreio.notaFiscal,
        mundo: pedidosRastreio.mundo,
        consultorId: pedidosRastreio.consultorId,
        clienteId: pedidosRastreio.clienteId,
        descricao: produtos.descricao,
      })
      .from(pedidosRastreio)
      .leftJoin(produtos, eq(pedidosRastreio.produtoSku, produtos.sku));
  } catch (error) {
    console.error("[SyncEngine] Erro ao buscar dados:", error);
    return [];
  }
}

// Filtra apenas quem tem avisos de E-mail pendentes
export async function getPendingNotifications() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select({
        id: pedidosRastreio.id,
        produtoSku: pedidosRastreio.produtoSku,
        quantidade: pedidosRastreio.quantidade,
        previsaoEntrega: pedidosRastreio.previsaoEntrega,
        dataEntrega: pedidosRastreio.dataEntrega,
        orderStatus: pedidosRastreio.orderStatus,
        notificationSentStatus: pedidosRastreio.notificationSentStatus,
        remetente: pedidosRastreio.remetente,
        notaFiscal: pedidosRastreio.notaFiscal,
        mundo: pedidosRastreio.mundo,
        consultorId: pedidosRastreio.consultorId,
        clienteId: pedidosRastreio.clienteId,
        descricao: produtos.descricao,
      })
      .from(pedidosRastreio)
      .leftJoin(produtos, eq(pedidosRastreio.produtoSku, produtos.sku))
      .where(like(pedidosRastreio.notificationSentStatus, "PENDING_%"));
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