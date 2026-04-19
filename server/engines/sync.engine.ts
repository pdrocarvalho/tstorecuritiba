/**
 * server/engines/sync.engine.ts
 */
import { google } from "googleapis";

// Cache simples para não sobrecarregar o Google
const sheetsCache: Record<string, { data: any[]; timestamp: number }> = {};
const CACHE_TTL_MS = 30 * 1000;

function getGoogleAuth() {
  const client_email = process.env.GOOGLE_SERVICE_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function extractSpreadsheetId(url: string) {
  const match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getSheetNameFromUrl(url: string, spreadsheet: any) {
  const match = String(url).match(/[#&]gid=([0-9]+)/);
  const gid = match ? parseInt(match[1], 10) : null;
  if (gid !== null) {
    const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.sheetId === gid);
    if (sheet && sheet.properties?.title) return sheet.properties.title;
  }
  return spreadsheet.data.sheets?.[0]?.properties?.title || "Página1";
}

// 🚀 O NOVO ROBÔ COM "MODOS" DE LEITURA
export async function fetchLiveGoogleSheet(sheetsUrl: string, mode: 'recebimento' | 'avarias' = 'recebimento') {
  const cacheKey = `${mode}-${sheetsUrl}`;
  const now = Date.now();
  if (sheetsCache[cacheKey] && (now - sheetsCache[cacheKey].timestamp < CACHE_TTL_MS)) {
    return sheetsCache[cacheKey].data;
  }

  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);

  const response = await sheets.spreadsheets.values.get({ 
    spreadsheetId, 
    range: `'${targetSheetName}'!A:Z` 
  });
  
  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  // Configurações específicas por modo
  let headerRowIndex = 0;
  if (mode === 'avarias') headerRowIndex = 2; // Linha 3 (index 2) para o RELATORIO_GERAL

  const headers = rows[headerRowIndex].map((h: any) => String(h || "").toUpperCase().trim());
  
  const data = rows.slice(headerRowIndex + 1).map((row, index) => {
    const obj: any = { rowNumber: headerRowIndex + index + 2 };

    headers.forEach((header, idx) => {
      if (!header) return;
      const val = row[idx] || "";
      const key = header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_");
      obj[key] = val;

      // Se for Recebimento, cria os campos que o frontend espera (LEGACY MAPPING)
      if (mode === 'recebimento') {
        if (header === "REF." || header === "REF") obj.produtoSku = String(val).trim();
        if (header === "VOLUMES") obj.quantidade = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
        if (header.includes("DESCRI")) obj.descricao = val;
        if (header.includes("REMETENTE")) obj.remetente = val;
        if (header.includes("NOTA FISCAL")) obj.notaFiscal = val;
        if (header.includes("MUNDO")) obj.mundo = val;
        if (header.includes("PREVIS")) {
            const parts = String(val).split("/");
            obj.previsaoEntrega = parts.length === 3 ? new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]), 12) : null;
        }
        if (header.includes("ENTREGA") && !header.includes("PREVIS")) {
            const parts = String(val).split("/");
            obj.dataEntrega = parts.length === 3 ? new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]), 12) : null;
        }
      }
    });
    return obj;
  });

  const filtered = data.filter(d => mode === 'avarias' ? (d.COD__AVARIA || d.REF_) : (d.produtoSku || d.REF_));
  sheetsCache[cacheKey] = { data: filtered, timestamp: now };
  return filtered;
}

// ... manter addRowToSheet e updateSheetRow como estão