/**
 * server/engines/google.helpers.ts
 *
 * Funções auxiliares compartilhadas entre os engines do Google Sheets.
 * Centraliza getGoogleAuth() e parseDataLimpa() para evitar duplicação.
 */

import { google } from "googleapis";

export function getGoogleAuth() {
  const client_email = process.env.GOOGLE_SERVICE_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!client_email || !private_key) throw new Error("Credenciais do Google ausentes.");
  return new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export function parseDataLimpa(dataRaw: any): Date | null {
  if (!dataRaw) return null;
  const str = String(dataRaw).trim();
  if (str.includes('/')) {
    const parts = str.split(/[/\s:-]/);
    if (parts.length >= 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);
      if (p0 > 12) return new Date(p2, p1 - 1, p0); // DD/MM/YYYY
      if (p1 > 12) return new Date(p2, p0 - 1, p1); // MM/DD/YYYY
      return new Date(p2, p1 - 1, p0); // Padrão BR
    }
  }
  const d = new Date(dataRaw);
  if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return null;
}