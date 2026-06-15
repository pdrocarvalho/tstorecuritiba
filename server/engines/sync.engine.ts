/**
 * server/engines/sync.engine.ts
 *
 * Orquestrador principal de sincronização com Google Sheets.
 * Delega I/O para sheets-client, parsing para sheets-parser
 * e cruzamento de demandas para cross-reference.
 *
 * Re-exporta funções de escrita para manter compatibilidade com os routers.
 */

import { readSheetData } from "./sheets-client";
import { parseHeaders, mapRecebimentoRow, mapAvariaRow, mapDemandaRow, AvariaRecord, DemandaRecord, RecebimentoRecord } from "./sheets-parser";
import { enriquecerDemandas } from "./cross-reference";

// Re-exporta funções de I/O para compatibilidade com os routers existentes
export { extractSpreadsheetId, addRowToSheet, updateFullRow, updateSheetRow, deleteSheetRow } from "./sheets-client";

// ---------------------------------------------------------------------------
// Cache em Memória (com evicção automática — resolve ARCH-10)
// ---------------------------------------------------------------------------

type AnySheetRecord = AvariaRecord | DemandaRecord | RecebimentoRecord;

const sheetsCache: Record<string, { data: AnySheetRecord[]; timestamp: number }> = {};
const CACHE_TTL_MS = 30 * 1000;

function limparCacheExpirado() {
  const now = Date.now();
  for (const key of Object.keys(sheetsCache)) {
    if (now - sheetsCache[key].timestamp >= CACHE_TTL_MS) {
      delete sheetsCache[key];
    }
  }
}

// ---------------------------------------------------------------------------
// Função Principal — Orquestradora
// ---------------------------------------------------------------------------

export async function fetchLiveGoogleSheet(
  sheetsUrl: string,
  mode: "recebimento" | "avarias" | "demandas" = "recebimento",
  targetTab?: string
): Promise<AnySheetRecord[]> {
  // 1. Cache
  const cacheKey = `${mode}-${targetTab || sheetsUrl}`;
  const now = Date.now();
  if (sheetsCache[cacheKey] && now - sheetsCache[cacheKey].timestamp < CACHE_TTL_MS) {
    return sheetsCache[cacheKey].data;
  }
  limparCacheExpirado();

  // 2. Leitura da planilha
  const { rows, sheets } = await readSheetData(sheetsUrl, targetTab);
  if (rows.length === 0) return [];

  // 3. Parse dos cabeçalhos
  const headerRowIndex = mode === "avarias" || mode === "demandas" ? 1 : 0;
  if (!rows[headerRowIndex]) return [];

  const { originais, limpos } = parseHeaders(rows[headerRowIndex] as any[]);

  // 4. Mapeamento das linhas pelo modo correto
  let data: AnySheetRecord[] = [];
  if (mode === "avarias") {
    data = rows.slice(headerRowIndex + 1).map((row, index) =>
      mapAvariaRow(originais, limpos, row as any[], headerRowIndex + index + 2)
    );
  } else if (mode === "demandas") {
    data = rows.slice(headerRowIndex + 1).map((row, index) =>
      mapDemandaRow(originais, limpos, row as any[], headerRowIndex + index + 2)
    );
  } else {
    data = rows.slice(headerRowIndex + 1).map((row, index) =>
      mapRecebimentoRow(originais, limpos, row as any[], headerRowIndex + index + 2)
    );
  }

  const filtered = data.filter(d => 
    ("referencia" in d && d.referencia) || 
    ("produtoSku" in d && d.produtoSku) || 
    ("REF" in d && d.REF) || 
    ("COD_AVARIA" in d && d.COD_AVARIA)
  );

  // 5. Cross-reference para demandas
  if (mode === "demandas") {
    await enriquecerDemandas(filtered as DemandaRecord[], sheets);
  }

  // 6. Atualiza cache
  sheetsCache[cacheKey] = { data: filtered, timestamp: now };
  return filtered;
}
