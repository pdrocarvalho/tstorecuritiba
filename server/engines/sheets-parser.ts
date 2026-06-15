/**
 * server/engines/sheets-parser.ts
 *
 * Módulo responsável por transformar linhas brutas do Google Sheets
 * em objetos tipados, separando a lógica de parsing por modo.
 */

// Tipo de célula bruta da API do Google Sheets
export type SheetCell = string | number | boolean | null | undefined;
export type SheetRow = SheetCell[];

// ---------------------------------------------------------------------------
// Normalização de Cabeçalhos
// ---------------------------------------------------------------------------

export function parseHeaders(headerRow: SheetRow) {
  const originais = headerRow.map(h => String(h || "").trim());
  const limpos = originais.map(h =>
    h.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "")
  );
  return { originais, limpos };
}

function toKey(header: string): string {
  return header.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_");
}

function isRefHeader(hLimpo: string): boolean {
  return hLimpo === "REF" || hLimpo.includes("REFERENCIA") || hLimpo === "REF_";
}

export function parseDataLimpa(val: SheetCell): Date | null {
  if (!val) return null;
  const p = String(val).split("/");
  if (p.length === 3) {
    return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10), 12);
  }
  return null;
}

// Tipos de Registros Mapeados
export type AvariaRecord = Record<string, string | number | null>;
export type DemandaRecord = Record<string, string | number | null>;
export type RecebimentoRecord = Record<string, string | number | Date | null>;

// ---------------------------------------------------------------------------
// Mapeamento por Modo
// ---------------------------------------------------------------------------

export function mapAvariaRow(
  headersOriginais: string[],
  headersLimpos: string[],
  row: SheetRow,
  rowNumber: number
): AvariaRecord {
  const obj: AvariaRecord = { rowNumber };

  headersOriginais.forEach((header, idx) => {
    const val = row[idx] !== undefined && row[idx] !== null ? String(row[idx]) : "";
    const hLimpo = headersLimpos[idx];
    obj[toKey(header)] = val;

    if (isRefHeader(hLimpo)) obj.REF = String(val).trim();
    if (hLimpo.includes("COD") && hLimpo.includes("AVARIA")) obj.COD_AVARIA = val;
    if (hLimpo.includes("FABRICA")) obj.FABRICA = val;
    if (hLimpo.includes("DESCRI")) obj.DESCRICAO = val;
    if (hLimpo.includes("QTDE")) obj.QTDE = val;
    if (hLimpo.includes("TRATATIVA")) obj.TRATATIVA = val;
    if (hLimpo === "STATUS") obj.STATUS = val;
    if (hLimpo.includes("OK") && hLimpo.includes("STATUS")) obj.OK_STATUS = val;
    if (hLimpo.includes("COLETA")) obj.DATA_DA_COLETA = val;
    if (hLimpo.includes("SAIDA")) obj.NOTA_FISCAL_DE_SAIDA = val;
    if (hLimpo.includes("REPOSICAO")) obj.NOTA_FISCAL_DE_REPOSICAO = val;
    if (hLimpo.includes("SISTEMA")) obj.FOI_LANCADO_NO_SISTEMA = val;
    if (hLimpo.includes("FISICAMENTE")) obj.CONSTA_FISICAMENTE = val;
    if (hLimpo.includes("MOTIVO")) obj.MOTIVO = val;
    if (hLimpo.includes("ENTRADA") && hLimpo.includes("DATA")) obj.DATA_DE_ENTRADA = val;
    if (hLimpo.includes("ENTRADA") && hLimpo.includes("FISCAL")) obj.NOTA_FISCAL_DE_ENTRADA = val;
    if (hLimpo.includes("CUPOM")) obj.CUPOM_FISCAL = val;
    if (hLimpo.includes("OBSERVA")) obj.OBSERVACOES = val;
  });

  return obj;
}

export function mapDemandaRow(
  headersOriginais: string[],
  headersLimpos: string[],
  row: SheetRow,
  rowNumber: number
): DemandaRecord {
  const obj: DemandaRecord = { rowNumber };

  headersOriginais.forEach((header, idx) => {
    const val = row[idx] !== undefined && row[idx] !== null ? String(row[idx]) : "";
    const hLimpo = headersLimpos[idx];
    obj[toKey(header)] = val;

    if (hLimpo === "DATA") obj.data = val;
    if (hLimpo.includes("CONSULTOR")) obj.consultor = val;
    if (hLimpo.includes("CLIENTE")) obj.cliente = val;
    if (hLimpo.includes("CONTATO")) obj.contato = val;
    if (isRefHeader(hLimpo)) obj.referencia = String(val).trim();
    if (hLimpo.includes("STATUS")) obj.status = val;
  });

  return obj;
}

export function mapRecebimentoRow(
  headersOriginais: string[],
  headersLimpos: string[],
  row: SheetRow,
  rowNumber: number
): RecebimentoRecord {
  const obj: RecebimentoRecord = { rowNumber };
  let tempQtdeCaixa = 0;
  let tempVolumes = 0;
  let hasQtdeCaixa = false;

  headersOriginais.forEach((header, idx) => {
    const val = row[idx] !== undefined && row[idx] !== null ? String(row[idx]) : "";
    const hLimpo = headersLimpos[idx];
    obj[toKey(header)] = val;

    if (isRefHeader(hLimpo)) obj.produtoSku = String(val).trim();
    if (hLimpo.includes("DESCRI")) obj.descricao = val;
    if (hLimpo.includes("REMETENTE")) obj.remetente = val;
    if (hLimpo.includes("NOTAFISCAL")) obj.notaFiscal = val;
    if (hLimpo.includes("MUNDO")) obj.mundo = val;
    if (hLimpo.includes("TRANSPORT")) obj.transportadora = val;
    if (hLimpo.includes("DIVERG")) obj.divergencia = String(val).toUpperCase().trim() || "SEM DIVERGÊNCIA";
    if (hLimpo === "MES" || (hLimpo.includes("MES") && !hLimpo.includes("PREVIS"))) obj.mes = val;

    if (hLimpo.includes("EMBARQUE")) {
      const p = String(val).split("/");
      obj.dataEmbarque = p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12) : null;
    }
    if (hLimpo.includes("PREVIS")) {
      const p = String(val).split("/");
      obj.previsaoEntrega = p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12) : null;
    }
    if (hLimpo.includes("ENTREGA") && !hLimpo.includes("PREVIS")) {
      const p = String(val).split("/");
      obj.dataEntrega = p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12) : null;
    }
    if (hLimpo === "VOLUMES") tempVolumes = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
    if (hLimpo.includes("QTDE") && hLimpo.includes("CAIXA")) {
      tempQtdeCaixa = parseInt(String(val).replace(/\D/g, ""), 10) || 0;
      hasQtdeCaixa = true;
    }
  });

  obj.volumesCaixas = tempVolumes;
  obj.qtdePorCaixa = tempQtdeCaixa;
  obj.quantidade = hasQtdeCaixa
    ? (tempVolumes === 0 ? tempQtdeCaixa : tempQtdeCaixa * tempVolumes)
    : tempVolumes;

  return obj;
}
