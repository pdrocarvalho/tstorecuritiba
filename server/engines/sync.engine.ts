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

function extractSpreadsheetId(url: string) {
  const match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Retorna tanto o Nome (Title) quanto o ID numérico da Aba (SheetId) - O ID numérico é crucial para deletar linhas.
function getSheetInfoFromUrl(url: string, spreadsheet: any) {
  const match = String(url).match(/[#&]gid=([0-9]+)/);
  const gid = match ? parseInt(match[1], 10) : null;
  
  if (gid !== null) {
    const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.sheetId === gid);
    if (sheet && sheet.properties?.title) {
      return { title: sheet.properties.title, sheetId: sheet.properties.sheetId };
    }
  }
  
  // Se não tiver GID na URL, pega a primeira aba por padrão
  const firstSheet = spreadsheet.data.sheets?.[0]?.properties;
  return { title: firstSheet?.title || "Página1", sheetId: firstSheet?.sheetId || 0 };
}

// (Mantém a antiga para retrocompatibilidade)
function getSheetNameFromUrl(url: string, spreadsheet: any) {
  return getSheetInfoFromUrl(url, spreadsheet).title;
}

// 🚀 LEITURA MULTI-MODO
export async function fetchLiveGoogleSheet(sheetsUrl: string, mode: 'recebimento' | 'avarias' = 'recebimento') {
  const cacheKey = `${mode}-${sheetsUrl}`;
  const now = Date.now();
  if (sheetsCache[cacheKey] && (now - sheetsCache[cacheKey].timestamp < CACHE_TTL_MS)) return sheetsCache[cacheKey].data;

  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);

  const response = await sheets.spreadsheets.values.get({ 
    spreadsheetId, range: `'${targetSheetName}'!A:Z` 
  });
  
  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  const headerRowIndex = mode === 'avarias' ? 2 : 0;
  if (!rows[headerRowIndex]) return [];
  const headers = rows[headerRowIndex].map((h: any) => String(h || "").toUpperCase().trim());
  
  const data = rows.slice(headerRowIndex + 1).map((row, index) => {
    const obj: any = { rowNumber: headerRowIndex + index + 2 }; // Guarda o número real da linha para edições futuras!
    
    // Variáveis temporárias para a matemática do Recebimento Futuro
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

        // 🚀 Captura os números para nossa lógica matemática
        if (header === "VOLUMES") {
            tempVolumes = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
        }
        if (header.includes("QTDE") && header.includes("CAIXA") || header === "QTDE. POR CAIXA") {
            tempQtdeCaixa = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
            hasQtdeCaixa = true;
        }
      }
    });

    // 🚀 APLICA A MATEMÁTICA INTELIGENTE (Somente no Recebimento Futuro)
    if (mode === 'recebimento') {
        if (hasQtdeCaixa) {
            if (tempVolumes === 0) {
                // Se zerou o volume na planilha, garante a quantidade unitária de 1 caixa
                obj.quantidade = tempQtdeCaixa; 
            } else {
                // Multiplicação normal: Volumes x Qtde por Caixa
                obj.quantidade = tempQtdeCaixa * tempVolumes; 
            }
        } else {
            // Se a coluna "QTDE POR CAIXA" não existir na planilha, usa apenas o Volume
            obj.quantidade = tempVolumes; 
        }
    }

    return obj;
  });

  const filtered = data.filter(d => mode === 'avarias' ? (d.COD__AVARIA || d.REF_) : (d.produtoSku || d.REF_));
  sheetsCache[cacheKey] = { data: filtered, timestamp: now };
  return filtered;
}

// ==========================================
// 🚀 FUNÇÕES DE ESCRITA E MODIFICAÇÃO (CRUD)
// ==========================================

export async function addRowToSheet(sheetsUrl: string, rowData: any[]) {
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);
  await sheets.spreadsheets.values.append({
    spreadsheetId, range: `'${targetSheetName}'!A:A`,
    valueInputOption: "USER_ENTERED", requestBody: { values: [rowData] },
  });
  Object.keys(sheetsCache).forEach(k => { if (k.includes(sheetsUrl)) delete sheetsCache[k]; });
  return { success: true };
}

// Edita apenas uma célula específica
export async function updateSheetRow(sheetsUrl: string, rowNum: number, col: string, val: string) {
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: `'${targetSheetName}'!${col}${rowNum}`,
    valueInputOption: "USER_ENTERED", requestBody: { values: [[val]] },
  });
  Object.keys(sheetsCache).forEach(k => { if (k.includes(sheetsUrl)) delete sheetsCache[k]; });
  return { success: true };
}

// 🆕 Edita uma linha inteira (várias colunas de uma vez)
export async function updateFullRow(sheetsUrl: string, rowNum: number, rowData: any[]) {
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const targetSheetName = getSheetNameFromUrl(sheetsUrl, spreadsheet);
  
  // Calcula até onde vai a alteração (A até a quantidade de colunas no array)
  const lastColLetter = String.fromCharCode(65 + rowData.length - 1); 

  await sheets.spreadsheets.values.update({
    spreadsheetId, 
    range: `'${targetSheetName}'!A${rowNum}:${lastColLetter}${rowNum}`,
    valueInputOption: "USER_ENTERED", 
    requestBody: { values: [rowData] },
  });
  
  Object.keys(sheetsCache).forEach(k => { if (k.includes(sheetsUrl)) delete sheetsCache[k]; });
  return { success: true };
}

// 🆕 Exclui a linha completamente da planilha (puxando as de baixo para cima)
export async function deleteSheetRow(sheetsUrl: string, rowNum: number) {
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");
  
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  
  // Para deletar, precisamos do ID numérico da aba, e não apenas o nome.
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetInfo = getSheetInfoFromUrl(sheetsUrl, spreadsheet);

  // A API do Google começa a contar linhas do zero (ex: Linha 1 = index 0).
  const startIndex = rowNum - 1; 

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetInfo.sheetId,
              dimension: "ROWS",
              startIndex: startIndex,
              endIndex: startIndex + 1, // Exclui apenas essa linha
            }
          }
        }
      ]
    }
  });

  // Limpa o cache para forçar a busca dos dados novos
  Object.keys(sheetsCache).forEach(k => { if (k.includes(sheetsUrl)) delete sheetsCache[k]; });
  
  return { success: true };
}

// ==========================================
// 🚀 FUNÇÕES DE ADMINISTRAÇÃO E TESTE
// ==========================================

export async function syncPedidosFromGoogleSheets(url: string) {
  console.log("Sincronizando banco via:", url);
  return { novosPedidos: 0, novasPrevisoes: 0, chegadas: 0, erros: [] };
}

export async function testarLeituraRobo(url: string) {
  const data = await fetchLiveGoogleSheet(url, 'recebimento');
  return { 
    status: "success", 
    linhasLidas: data.length, 
    exemplo: data[0] || "Nenhuma linha encontrada" 
  };
}