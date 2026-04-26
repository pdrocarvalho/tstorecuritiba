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
    if (sheet?.properties?.title) return { title: sheet.properties.title, sheetId: sheet.properties.sheetId };
  }
  const firstSheet = spreadsheet.data.sheets?.[0]?.properties;
  return { title: firstSheet?.title || "Página1", sheetId: firstSheet?.sheetId || 0 };
}

function getSheetNameFromUrl(url: string, spreadsheet: any) {
  return getSheetInfoFromUrl(url, spreadsheet).title;
}

// 🚀 LEITURA MULTI-MODO (VERSÃO RAIO-X BLINDADA)
export async function fetchLiveGoogleSheet(sheetsUrl: string, mode: 'recebimento' | 'avarias' | 'demandas' = 'recebimento', targetTab?: string) {
  const cacheKey = `${mode}-${targetTab || sheetsUrl}`;
  const now = Date.now();
  if (sheetsCache[cacheKey] && (now - sheetsCache[cacheKey].timestamp < CACHE_TTL_MS)) return sheetsCache[cacheKey].data;

  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  
  let targetSheetName = targetTab;
  if (!targetSheetName) {
      // Corrigido: spreadsheetId as string para evitar erro de null
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
      targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);
  }

  const response = await sheets.spreadsheets.values.get({ 
    spreadsheetId: spreadsheetId as string, 
    range: `'${targetSheetName}'!A:Z` 
  });
  
  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  const headerRowIndex = mode === 'avarias' ? 2 : 0;
  if (!rows[headerRowIndex]) return [];
  
  // Limpa os cabeçalhos: remove acentos, espaços e pontos para comparação
  const headers = rows[headerRowIndex].map((h: any) => 
    String(h || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim()
  );
  
  const data = rows.slice(headerRowIndex + 1).map((row, index) => {
    const obj: any = { rowNumber: headerRowIndex + index + 2 }; 
    let tempQtdeCaixa = 0, tempVolumes = 0, hasQtdeCaixa = false;

    headers.forEach((headerLimpo, idx) => {
      if (!headerLimpo) return;
      const val = row[idx] || "";
      
      const isColunaReferencia = headerLimpo === "REF" || headerLimpo.includes("REFERENCIA");

      if (mode === 'recebimento') {
        if (isColunaReferencia) obj.produtoSku = String(val).trim();
        if (headerLimpo.includes("DESCRI")) obj.descricao = val;
        if (headerLimpo.includes("REMETENTE")) obj.remetente = val;
        if (headerLimpo.includes("NOTAFISCAL")) obj.notaFiscal = val;
        if (headerLimpo.includes("MUNDO")) obj.mundo = val;
        
        if (headerLimpo.includes("PREVIS")) {
            const p = String(val).split("/");
            obj.previsaoEntrega = p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]), 12) : null;
        }
        if (headerLimpo.includes("ENTREGA") && !headerLimpo.includes("PREVIS")) {
            const p = String(val).split("/");
            obj.dataEntrega = p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]), 12) : null;
        }
        if (headerLimpo === "VOLUMES") tempVolumes = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
        if ((headerLimpo.includes("QTDE") && headerLimpo.includes("CAIXA")) || headerLimpo === "QTDEPORCAIXA") {
            tempQtdeCaixa = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
            hasQtdeCaixa = true;
        }
      }

      if (mode === 'demandas') {
          if (headerLimpo.includes("CONSULTOR")) obj.consultor = val;
          if (headerLimpo.includes("CLIENTE")) obj.cliente = val;
          if (headerLimpo.includes("CONTATO")) obj.contato = val;
          if (isColunaReferencia) obj.referencia = String(val).trim();
          if (headerLimpo.includes("STATUS")) obj.status = val;
      }
    });

    if (mode === 'recebimento') {
        obj.volumesCaixas = tempVolumes; 
        obj.quantidade = hasQtdeCaixa ? (tempVolumes === 0 ? tempQtdeCaixa : tempQtdeCaixa * tempVolumes) : tempVolumes;
    }
    return obj;
  });

  const filtered = data.filter(d => (mode === 'demandas' ? d.referencia : (d.produtoSku || d.REF_)));
  
  sheetsCache[cacheKey] = { data: filtered, timestamp: now };
  return filtered;
}

export async function addRowToSheet(sheetsUrl: string, rowData: any[], targetTab?: string) {
    const spreadsheetId = extractSpreadsheetId(sheetsUrl);
    if (!spreadsheetId) throw new Error("URL inválida.");

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    
    // Corrigido: spreadsheetId as string
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
    const abasDisponiveis = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
    
    let targetSheetName = targetTab;
    if (targetTab) {
        const abaEncontrada = abasDisponiveis.find(aba => aba?.trim().toUpperCase() === targetTab.trim().toUpperCase());
        if (!abaEncontrada) throw new Error(`A aba não existe no arquivo!`);
        targetSheetName = abaEncontrada;
    } else {
        targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);
    }

    await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId as string,
        range: `'${targetSheetName}'!A:Z`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [rowData] }
    });
}

// Funções de Update/Delete com correção de tipo
export async function updateSheetRow(sheetsUrl: string, rowNum: number, col: string, val: string) {
    const spreadsheetId = extractSpreadsheetId(sheetsUrl);
    if (!spreadsheetId) return;
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
    const targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);

    await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId as string,
        range: `'${targetSheetName}'!${col}${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[val]] }
    });
}

export async function updateFullRow(sheetsUrl: string, rowNum: number, rowData: any[]) {
    const spreadsheetId = extractSpreadsheetId(sheetsUrl);
    if (!spreadsheetId) return;
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
    const targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);

    await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId as string,
        range: `'${targetSheetName}'!A${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowData] }
    });
}

export async function deleteSheetRow(sheetsUrl: string, rowNum: number) {
    const spreadsheetId = extractSpreadsheetId(sheetsUrl);
    if (!spreadsheetId) return;
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
    const sheetInfo = getSheetInfoFromUrl(sheetsUrl, spreadsheet);

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId as string,
        requestBody: {
            requests: [
                {
                    deleteDimension: {
                        range: {
                            sheetId: sheetInfo.sheetId,
                            dimension: "ROWS",
                            startIndex: rowNum - 1,
                            endIndex: rowNum
                        }
                    }
                }
            ]
        }
    });
}

export async function syncPedidosFromGoogleSheets(url: string) { return { novosPedidos: 0, novasPrevisoes: 0, chegadas: 0, erros: [] }; }
export async function testarLeituraRobo(url: string) { return { status: "success", linhasLidas: 0, exemplo: "" }; }