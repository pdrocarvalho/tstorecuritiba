/**
 * server/engines/cross-reference.ts
 *
 * Módulo responsável pela lógica de cruzamento de demandas com o banco
 * de dados na nuvem (DB_SPREADSHEET_ID). Elimina a duplicação entre
 * sync.engine.ts e notification.engine.ts (ARCH-03).
 */

import { google, sheets_v4 } from "googleapis";
import { parseDataLimpa, parseHeaders, mapRecebimentoRow } from "./sheets-parser";
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
  quantidade: number;
  descricao: string;
  fornecedor: string;
  nf: string;
  transportadora: string;
  volumes: number;
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
    range: "A:O", // Mantenha A:O ou expanda conforme necessário
  });

  const dbRows = dbResponse.data.values || [];
  if (dbRows.length < 2) return [];

  const headerRow = dbRows[0];
  const { originais, limpos } = parseHeaders(headerRow);

  const records: DbRecord[] = [];
  
  for (let i = 1; i < dbRows.length; i++) {
    const row = dbRows[i];
    const rec = mapRecebimentoRow(originais, limpos, row, i + 1);
    
    if (rec.produtoSku) {
      records.push({
        ref: String(rec.produtoSku),
        dataEmbarque: rec.dataEmbarque as Date | null,
        previsao: rec.previsaoEntrega ? (rec.previsaoEntrega as Date).toLocaleDateString('pt-BR') : (String(rec.previsao || "")),
        dataEntrega: rec.dataEntrega ? (rec.dataEntrega as Date).toLocaleDateString('pt-BR') : (String(rec.data_entrega || "")),
        quantidade: Number(rec.quantidade) || 0,
        descricao: String(rec.descricao || "-").toUpperCase(),
        fornecedor: String(rec.remetente || "-").toUpperCase(),
        nf: String(rec.notaFiscal || "-"),
        transportadora: String(rec.transportadora || "-").toUpperCase(),
        volumes: Number(rec.volumesCaixas) || 0
      });
    }
  }

  return records;
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
