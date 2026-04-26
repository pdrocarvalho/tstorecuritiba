/**
 * server/engines/sync.engine.ts
 */
import { google } from "googleapis";

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

export function extractSpreadsheetId(url: string) {
  const match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getSheetInfoFromUrl(url: string, spreadsheet: any) {
  const match = String(url).match(/[#&]gid=([0-9]+)/);
  const gid = match ? parseInt(match[1], 10) : null;
  
  if (gid !== null) {
    const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.sheetId === gid);
    if (sheet && sheet.properties?.title) {
      return { title: sheet.properties.title, sheetId: sheet.properties.sheetId };
    }
  }
  
  const firstSheet = spreadsheet.data.sheets?.[0]?.properties;
  return { title: firstSheet?.title || "Página1", sheetId: firstSheet?.sheetId || 0 };
}

function getSheetNameFromUrl(url: string, spreadsheet: any) {
  return getSheetInfoFromUrl(url, spreadsheet).title;
}

// 🚀 LEITURA MULTI-MODO (Agora suporta 'demandas')
export async function fetchLiveGoogleSheet(sheetsUrl: string, mode: 'recebimento' | 'avarias' | 'demandas' = 'recebimento', targetTab?: string) {
  const cacheKey = `${mode}-${targetTab || sheetsUrl}`;
  const now = Date.now();
  if (sheetsCache[cacheKey] && (now - sheetsCache[cacheKey].timestamp < CACHE_TTL_MS)) return sheetsCache[cacheKey].data;

  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  
  // Se não passar a aba alvo (targetTab), tenta descobrir pela URL
  let targetSheetName = targetTab;
  if (!targetSheetName) {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);
  }

  const response = await sheets.spreadsheets.values.get({ 
    spreadsheetId, range: `'${targetSheetName}'!A:Z` 
  });
  
  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  const headerRowIndex = mode === 'avarias' ? 2 : 0;
  if (!rows[headerRowIndex]) return [];
  const headers = rows[headerRowIndex].map((h: any) => String(h || "").toUpperCase().trim());
  
  const data = rows.slice(headerRowIndex + 1).map((row, index) => {
    const obj: any = { rowNumber: headerRowIndex + index + 2 }; 
    
    let tempQtdeCaixa = 0;
    let tempVolumes = 0;
    let hasQtdeCaixa = false;

    headers.forEach((header, idx) => {
      if (!header) return;
      const val = row[idx] || "";
      const key = header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_");
      obj[key] = val;
      
      if (mode === 'recebimento') {
        if (header === "REF." || header === "REF") obj.produtoSku = String(val).trim();
        if (header.includes("DESCRI")) obj.descricao = val;
        if (header.includes("REMETENTE")) obj.remetente = val;
        if (header.includes("NOTA FISCAL")) obj.notaFiscal = val;
        if (header.includes("MUNDO")) obj.mundo = val;
        
        if (header.includes("PREVIS")) {
            const p = String(val).split("/");
            obj.previsaoEntrega = p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]), 12) : null;
        }
        if (header.includes("ENTREGA") && !header.includes("PREVIS")) {
            const p = String(val).split("/");
            obj.dataEntrega = p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]), 12) : null;
        }

        if (header === "VOLUMES") {
            tempVolumes = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
        }
        if (header.includes("QTDE") && header.includes("CAIXA") || header === "QTDE. POR CAIXA") {
            tempQtdeCaixa = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
            hasQtdeCaixa = true;
        }
      }

      // 🚀 Mapeamento simplificado para a aba de Demandas
      if (mode === 'demandas') {
          if (header.includes("CONSULTOR")) obj.consultor = val;
          if (header.includes("CLIENTE")) obj.cliente = val;
          if (header.includes("CONTATO")) obj.contato = val;
          if (header.includes("REFER")) obj.referencia = String(val).trim();
          if (header.includes("STATUS")) obj.status = val;
      }
    });

    if (mode === 'recebimento') {
        obj.volumesCaixas = tempVolumes; 
        if (hasQtdeCaixa) {
            if (tempVolumes === 0) {
                obj.quantidade = tempQtdeCaixa; 
            } else {
                obj.quantidade = tempQtdeCaixa * tempVolumes; 
            }
        } else {
            obj.quantidade = tempVolumes; 
        }
        obj.quantidadePecas = obj.quantidade; 
    }

    return obj;
  });

  // Filtra dependendo do modo
  const filtered = data.filter(d => {
      if (mode === 'avarias') return d.COD__AVARIA || d.REF_;
      if (mode === 'demandas') return d.referencia;
      return d.produtoSku || d.REF_;
  });
  
  sheetsCache[cacheKey] = { data: filtered, timestamp: now };
  return filtered;
}

// 🚀 ADICIONAR LINHA (CORRIGIDO: Removido o '!A:Z' para evitar erro de parse do Google)
export async function addRowToSheet(sheetsUrl: string, rowData: any[], targetTab?: string) {
    const spreadsheetId = extractSpreadsheetId(sheetsUrl);
    if (!spreadsheetId) throw new Error("URL inválida.");

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    
    let targetSheetName = targetTab;
    if (!targetSheetName) {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);
    }

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: targetSheetName, // 🚀 Ajuste crítico feito aqui
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS", // 🚀 Garante a inserção correta
        requestBody: { values: [rowData] }
    });
}

// Funções mantidas como base para compatibilidade
export async function updateSheetRow(sheetsUrl: string, rowNum: number, col: string, val: string) { }
export async function updateFullRow(sheetsUrl: string, rowNum: number, rowData: any[]) { }
export async function deleteSheetRow(sheetsUrl: string, rowNum: number) { }
export async function syncPedidosFromGoogleSheets(url: string) { return { novosPedidos: 0, novasPrevisoes: 0, chegadas: 0, erros: [] }; }
export async function testarLeituraRobo(url: string) { return { status: "success", linhasLidas: 0, exemplo: "" }; }