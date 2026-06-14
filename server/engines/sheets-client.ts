/**
 * server/engines/sheets-client.ts
 *
 * Módulo responsável por toda a comunicação (I/O) com a API do Google Sheets.
 * Centraliza leitura, escrita, atualização e exclusão de dados.
 */

import { google } from "googleapis";
import { getGoogleAuth } from "./google.helpers";

// ---------------------------------------------------------------------------
// Utilitários de URL
// ---------------------------------------------------------------------------

export function extractSpreadsheetId(url: string): string | null {
  const match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function getSheetInfoFromUrl(url: string, spreadsheet: any) {
  const match = String(url).match(/[#&]gid=([0-9]+)/);
  const gid = match ? parseInt(match[1], 10) : null;
  if (gid !== null) {
    const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.sheetId === gid);
    if (sheet?.properties?.title) return { title: sheet.properties.title, sheetId: sheet.properties.sheetId };
  }
  const firstSheet = spreadsheet.data.sheets?.[0]?.properties;
  return { title: firstSheet?.title || "Página1", sheetId: firstSheet?.sheetId || 0 };
}

export function getSheetNameFromUrl(url: string, spreadsheet: any): string {
  return getSheetInfoFromUrl(url, spreadsheet).title;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/** Lê todas as linhas de uma aba da planilha (A:Z). */
export async function readSheetData(sheetsUrl: string, targetTab?: string) {
  const spreadsheetId = extractSpreadsheetId(sheetsUrl);
  if (!spreadsheetId) throw new Error("URL inválida.");

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });

  const targetSheetName = targetTab || getSheetNameFromUrl(sheetsUrl, spreadsheet);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${targetSheetName}'!A:Z`,
  });

  return {
    rows: response.data.values || [],
    sheets,
    spreadsheet,
    spreadsheetId,
    targetSheetName,
  };
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

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
    requestBody: { values: [rowData] },
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
    requestBody: { values: [rowData] },
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
    requestBody: { values: [[val]] },
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
            endIndex: rowNumber,
          },
        },
      }],
    },
  });
}
