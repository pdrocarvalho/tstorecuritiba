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
import { parseHeaders, mapRecebimentoRow, mapAvariaRow, mapDemandaRow } from "./sheets-parser";
import { enriquecerDemandas } from "./cross-reference";

// Re-exporta funções de I/O para compatibilidade com os routers existentes
export { extractSpreadsheetId, addRowToSheet, updateFullRow, updateSheetRow, deleteSheetRow } from "./sheets-client";

// ---------------------------------------------------------------------------
// Cache em Memória (com evicção automática — resolve ARCH-10)
// ---------------------------------------------------------------------------

const sheetsCache: Record<string, { data: any[]; timestamp: number }> = {};
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
) {
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

  const { originais, limpos } = parseHeaders(rows[headerRowIndex]);

  // 4. Mapeamento das linhas pelo modo correto
  const mapFn =
    mode === "avarias" ? mapAvariaRow :
    mode === "demandas" ? mapDemandaRow :
    mapRecebimentoRow;

  const data = rows.slice(headerRowIndex + 1).map((row, index) =>
    mapFn(originais, limpos, row, headerRowIndex + index + 2)
  );

  const filtered = data.filter(d => d.referencia || d.produtoSku || d.REF || d.COD_AVARIA);

  // 5. Cross-reference para demandas
  if (mode === "demandas") {
    await enriquecerDemandas(filtered, sheets);
  }

  // 6. Atualiza cache
  sheetsCache[cacheKey] = { data: filtered, timestamp: now };
  return filtered;
}
