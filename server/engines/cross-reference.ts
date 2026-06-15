/**
 * server/engines/cross-reference.ts
 *
 * Módulo responsável pela lógica de cruzamento de demandas com o banco
 * de dados na nuvem (DB_SPREADSHEET_ID). Elimina a duplicação entre
 * sync.engine.ts e notification.engine.ts (ARCH-03).
 */

import { google, sheets_v4 } from "googleapis";
import { parseDataLimpa } from "./sheets-parser";
import { getGoogleAuth } from "./google.helpers";
import { env } from "../_core/env";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DbRecord {
  ref: string;
  dataEmbarque: Date | null;
  previsao: string;
  dataEntrega: string;
}

export type StatusDemanda = "AGUARDANDO" | "FATURADA" | "PREVISÃO" | "CHEGOU";

// ---------------------------------------------------------------------------
// Leitura do Banco na Nuvem
// ---------------------------------------------------------------------------

/** Lê os registos do DB_SPREADSHEET_ID e devolve-os normalizados. */
export async function fetchDbRecords(sheets?: sheets_v4.Sheets): Promise<DbRecord[]> {
  const dbSpreadsheetId = env.DB_SPREADSHEET_ID;
  if (!dbSpreadsheetId) throw new Error("DB_SPREADSHEET_ID não definido no .env");

  if (!sheets) {
    const auth = getGoogleAuth();
    sheets = google.sheets({ version: "v4", auth });
  }

  const dbResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: dbSpreadsheetId,
    range: "A:O",
  });

  const dbRows = dbResponse.data.values || [];

  return dbRows
    .map(r => ({
      ref: String(r[0] || "").toUpperCase().trim(),
      dataEmbarque: parseDataLimpa(r[12]),           // Coluna M
      previsao: r[13] ? String(r[13]).trim() : "",   // Coluna N
      dataEntrega: r[14] ? String(r[14]).trim() : "", // Coluna O
    }))
    .filter(r => r.ref);
}

// ---------------------------------------------------------------------------
// Determinação de Status (Regra Cronológica)
// ---------------------------------------------------------------------------

/** Determina o status de uma demanda com base na regra cronológica. */
export function determinarStatusDemanda(
  ref: string,
  dataRegistro: Date | null,
  dbRecords: DbRecord[]
): StatusDemanda {
  if (!ref || !dataRegistro) return "AGUARDANDO";

  const refUpper = ref.toUpperCase();

  for (let i = dbRecords.length - 1; i >= 1; i--) {
    const rec = dbRecords[i];
    if (rec.ref === refUpper && rec.dataEmbarque && rec.dataEmbarque.getTime() >= dataRegistro.getTime()) {
      if (rec.dataEntrega) return "CHEGOU";
      if (rec.previsao) return "PREVISÃO";
      return "FATURADA";
    }
  }

  return "AGUARDANDO";
}

// ---------------------------------------------------------------------------
// Enriquecimento de Demandas (usado pelo sync.engine.ts)
// ---------------------------------------------------------------------------

import { DemandaRecord } from "./sheets-parser";

/** Aplica o cross-reference a uma lista de demandas, atualizando o campo `status`. */
export async function enriquecerDemandas(demandas: DemandaRecord[], sheets?: sheets_v4.Sheets): Promise<void> {
  try {
    const dbRecords = await fetchDbRecords(sheets);

    demandas.forEach(demanda => {
      if (!demanda.referencia || !demanda.data) return;
      const dataRegistro = parseDataLimpa(demanda.data);
      demanda.status = determinarStatusDemanda(String(demanda.referencia), dataRegistro, dbRecords);
    });
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error("Erro ao cruzar demandas com o BD na nuvem:", e.message);
    } else {
      console.error("Erro ao cruzar demandas com o BD na nuvem:", e);
    }
  }
}
