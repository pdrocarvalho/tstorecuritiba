/**
 * server/engines/sync.engine.ts
 */

import { google } from "googleapis";

// ⏳ SISTEMA DE CACHE (MEMÓRIA CURTA DE 30 SEGUNDOS)
interface CacheEntry {
  data: any[];
  timestamp: number;
}
const sheetsCache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 30 * 1000;

function getGoogleAuth() {
  const client_email = process.env.GOOGLE_SERVICE_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!client_email || !private_key) throw new Error("Credenciais do Google ausentes.");
  
  return new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    // 🔓 MUDANÇA CRÍTICA: Removido o ".readonly" para permitir ESCRITA (Edição/Adição)
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// 🛡️ PARSE DE DATA SEGURO
function parseDateSafe(dateVal: any): Date | null {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  if (!str || str === "" || str === "-") return null;
  try {
    if (str.includes("/")) {
      const parts = str.split("/");
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const yearStr = parts[2]?.split(" ")[0] || "0";
      const year = yearStr.length <= 2 ? 2000 + parseInt(yearStr, 10) : parseInt(yearStr, 10);
      return new Date(year, month, day, 12, 0, 0);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

// 🚀 BUSCA "SOB DEMANDA" (MANTIDA PARA RECEBIMENTO E AVARIAS)
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
  
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title;

  if (!firstSheetName) throw new Error("Página da planilha não encontrada.");
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: firstSheetName });
  const rows = response.data.values;
  
  if (!rows || rows.length === 0) return [];

  // Mapeamento dinâmico de cabeçalho
  const headers = rows[0].map((h: any) => String(h || "").toUpperCase().trim());
  
  const data = rows.slice(1).map((row) => {
    const obj: any = {};
    headers.forEach((header, index) => {
      let val = row[index] || null;
      // Normalização básica de nomes de campos para o frontend
      const key = header
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/[^A-Z0-9]/g, "_"); // substitui símbolos por _
      
      obj[key] = val;
    });
    
    // Tratamentos específicos de tipos que já conhecemos
    if (obj.REF) obj.produtoSku = String(obj.REF).trim();
    if (obj.VOLUMES) obj.quantidade = parseInt(String(obj.VOLUMES).replace(/\D/g, ""), 10) || 0;
    if (obj.QTDE_) obj.quantidadeAvaria = parseInt(String(obj.QTDE_).replace(/\D/g, ""), 10) || 0;
    
    return obj;
  });

  sheetsCache[sheetsUrl] = { data, timestamp: Date.now() };
  return data;
}

// ✍️ NOVA FUNÇÃO: ADICIONAR LINHA (PARA AVARIAS)
export async function addRowToSheet(sheetsUrl: string, rowData: any[]) {
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetName = spreadsheet.data.sheets?.[0]?.properties?.title;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rowData] },
  });

  // Limpa o cache para forçar a leitura dos dados novos na próxima vez
  delete sheetsCache[sheetsUrl];
  return { success: true };
}