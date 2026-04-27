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

export async function fetchLiveGoogleSheet(sheetsUrl: string, mode: 'recebimento' | 'avarias' | 'demandas' = 'recebimento', targetTab?: string) {
  const cacheKey = `${mode}-${targetTab || sheetsUrl}`;
  const now = Date.now();
  if (sheetsCache[cacheKey] && (now - sheetsCache[cacheKey].timestamp < CACHE_TTL_MS)) return sheetsCache[cacheKey].data;

  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
  
  let targetSheetName = targetTab;
  if (!targetSheetName) {
      targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);
  }

  const response = await sheets.spreadsheets.values.get({ 
    spreadsheetId: spreadsheetId as string, 
    range: `'${targetSheetName}'!A:Z` 
  });
  
  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  // Ajuste: Avarias e Demandas estão na Linha 2 (index 1)
  let headerRowIndex = 0;
  if (mode === 'avarias' || mode === 'demandas') {
      headerRowIndex = 1; 
  }

  if (!rows[headerRowIndex]) return [];
  
  const headersOriginais = rows[headerRowIndex].map((h: any) => String(h || "").trim());
  const headersLimpos = headersOriginais.map(h => h.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, ""));
  
  const data = rows.slice(headerRowIndex + 1).map((row, index) => {
    const obj: any = { rowNumber: headerRowIndex + index + 2 }; 
    let tempQtdeCaixa = 0, tempVolumes = 0, hasQtdeCaixa = false;

    headersOriginais.forEach((header, idx) => {
      const val = row[idx] || "";
      const hLimpo = headersLimpos[idx];
      
      const key = header.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_");
      obj[key] = val;

      const isRef = hLimpo === "REF" || hLimpo.includes("REFERENCIA");

      if (mode === 'recebimento') {
        if (isRef) obj.produtoSku = String(val).trim();
        if (hLimpo.includes("DESCRI")) obj.descricao = val;
        if (hLimpo.includes("REMETENTE")) obj.remetente = val;
        if (hLimpo.includes("NOTAFISCAL")) obj.notaFiscal = val;
        if (hLimpo.includes("MUNDO")) obj.mundo = val;
        
        if (hLimpo.includes("PREVIS")) {
            const p = String(val).split("/");
            obj.previsaoEntrega = p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]), 12) : null;
        }
        if (hLimpo.includes("ENTREGA") && !hLimpo.includes("PREVIS")) {
            const p = String(val).split("/");
            obj.dataEntrega = p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]), 12) : null;
        }
        if (hLimpo === "VOLUMES") tempVolumes = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
        if (hLimpo.includes("QTDE") && hLimpo.includes("CAIXA")) {
            tempQtdeCaixa = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
            hasQtdeCaixa = true;
        }
      }

      if (mode === 'demandas') {
          if (hLimpo.includes("CONSULTOR")) obj.consultor = val;
          if (hLimpo.includes("CLIENTE")) obj.cliente = val;
          if (hLimpo.includes("CONTATO")) obj.contato = val;
          if (isRef) obj.referencia = String(val).trim();
          if (hLimpo.includes("STATUS")) obj.status = val;
          if (hLimpo.includes("DATASTATUS")) obj.DATA_STATUS = val;
      }

      if (mode === 'avarias') {
          if (isRef) obj.REF = String(val).trim();
          if (hLimpo.includes("COD") && hLimpo.includes("AVARIA")) obj.COD_AVARIA = val;
          if (hLimpo.includes("DESCRI")) obj.DESCRICAO = val;
          if (hLimpo.includes("QTDE")) obj.QTDE = val;
          if (hLimpo.includes("TRATATIVA")) obj.TRATATIVA = val;
      }
    });

    if (mode === 'recebimento') {
        obj.volumesCaixas = tempVolumes; 
        obj.quantidade = hasQtdeCaixa ? (tempVolumes === 0 ? tempQtdeCaixa : tempQtdeCaixa * tempVolumes) : tempVolumes;
    }
    return obj;
  });

  const filtered = data.filter(d => (d.referencia || d.produtoSku || d.REF || d.COD_AVARIA || d.REF_));
  
  sheetsCache[cacheKey] = { data: filtered, timestamp: now };
  return filtered;
}

export async function addRowToSheet(sheetsUrl: string, rowData: any[], targetTab?: string) {
    const spreadsheetId = extractSpreadsheetId(sheetsUrl);
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId as string });
    const targetSheetName = targetTab || getSheetNameFromUrl(sheetsUrl, spreadsheet);
    await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId as string,
        range: `'${targetSheetName}'!A:Z`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [rowData] }
    });
}

export async function updateSheetRow(url: string, row: number, col: string, val: string) {
    const id = extractSpreadsheetId(url);
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: id as string });
    const targetSheetName = getSheetNameFromUrl(url, spreadsheet);
    await sheets.spreadsheets.values.update({
        spreadsheetId: id as string,
        range: `'${targetSheetName}'!${col}${row}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[val]] }
    });
}

export async function updateFullRow(url: string, rowNumber: number, rowData: any[]) {
    const id = extractSpreadsheetId(url);
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: id as string });
    const targetSheetName = getSheetNameFromUrl(url, spreadsheet);
    await sheets.spreadsheets.values.update({
        spreadsheetId: id as string,
        range: `'${targetSheetName}'!A${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowData] }
    });
}

export async function deleteSheetRow(url: string, rowNumber: number) {
    const id = extractSpreadsheetId(url);
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: id as string });
    const sheetInfo = getSheetInfoFromUrl(url, spreadsheet);

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id as string,
        requestBody: {
            requests: [{
                deleteDimension: {
                    range: {
                        sheetId: sheetInfo.sheetId,
                        dimension: "ROWS",
                        startIndex: rowNumber - 1,
                        endIndex: rowNumber
                    }
                }
            }]
        }
    });
}

export async function syncPedidosFromGoogleSheets(url: string) { return { novosPedidos: 0, novasPrevisoes: 0, chegadas: 0, erros: [] }; }
export async function testarLeituraRobo(url: string) { return { status: "success", linhasLidas: 0, exemplo: "" }; }