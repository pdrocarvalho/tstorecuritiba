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
export type AvariaRecord = Record<string, string | number | null> & { sheetId?: string };
export type DemandaRecord = Record<string, string | number | null> & { sheetId?: string };
export type RecebimentoRecord = Record<string, string | number | Date | null> & { sheetId?: string };

// ---------------------------------------------------------------------------
// Mapeamento por Modo
// ---------------------------------------------------------------------------

export function mapAvariaRow(
  headersOriginais: string[],
  headersLimpos: string[],
  row: SheetRow,
  rowNumber: number
): AvariaRecord {
  const getVal = (idx: number) => row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";
  
  const obj: AvariaRecord = {
    rowNumber,
    sheetId: getVal(0),
    COD_AVARIA: getVal(0),
    DATA_DE_ENTRADA: getVal(1),
    FABRICA: getVal(2),
    REF: getVal(3),
    DESCRICAO: getVal(4),
    QTDE: getVal(5),
    NOTA_FISCAL_DE_ENTRADA: getVal(6),
    CUPOM_FISCAL: getVal(7),
    MOTIVO: getVal(8),
    RESPONSAVEL: getVal(9),
    FOI_LANCADO_NO_SISTEMA: getVal(10),
    TRATATIVA: getVal(11),
    CONSTA_FISICAMENTE: getVal(12),
    DATA_DA_COLETA: getVal(13),
    NOTA_FISCAL_DE_SAIDA: getVal(14),
    NOTA_FISCAL_DE_REPOSICAO: getVal(15),
    STATUS: getVal(16),
    OK_STATUS: getVal(17),
    OBSERVACOES: getVal(18),
    THREAD_ID: getVal(19)
  };

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

    if (hLimpo === "ID" || hLimpo === "ID_DEMANDA" || hLimpo === "IDDEMANDA" || (hLimpo.includes("COD") && hLimpo.includes("DEMANDA"))) {
      obj.sheetId = val;
    }
    if (hLimpo === "DATA") obj.data = val;
    if (hLimpo.includes("CONSULTOR")) obj.consultor = val;
    if (hLimpo.includes("CLIENTE")) obj.cliente = val;
    if (hLimpo.includes("CONTATO")) obj.contato = val;
    if (isRefHeader(hLimpo)) obj.referencia = String(val).trim();
    if (hLimpo.includes("STATUS")) obj.status = val;
    if (hLimpo === "QTDE" || hLimpo.includes("QUANTIDADE")) obj.quantidade = parseInt(String(val).replace(/\D/g, ""), 10) || 1;
    if (hLimpo.includes("THREAD") || hLimpo === "ID") obj.threadId = val;
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

    if (hLimpo === "ID" || hLimpo === "ID_RECEBIMENTO" || hLimpo === "IDRECEBIMENTO" || (hLimpo.includes("COD") && hLimpo.includes("RECEBIMENTO"))) {
      obj.sheetId = val;
    }
    if (isRefHeader(hLimpo)) obj.produtoSku = String(val).trim();
    if (hLimpo.includes("DESCRI")) obj.descricao = val;
    if (hLimpo.includes("REMETENTE")) obj.remetente = val;
    if (hLimpo.includes("NOTAFISCAL") && !hLimpo.includes("FATURADA")) obj.notaFiscal = val;
    if (hLimpo.includes("MUNDO")) obj.mundo = val;
    if (hLimpo.includes("TRANSPORT")) obj.transportadora = val;
    if (hLimpo.includes("DIVERG")) obj.divergencia = String(val).toUpperCase().trim() || "SEM DIVERGÊNCIA";
    if (hLimpo === "MES" || (hLimpo.includes("MES") && !hLimpo.includes("PREVIS"))) obj.mes = val;
    
    // Colunas Financeiras
    if (hLimpo.includes("VALOR") && hLimpo.includes("DESCONTO")) obj.valorDesconto = val;
    if (hLimpo.includes("DESCONTO") && hLimpo.includes("PROMOCIONAL")) obj.descontoPromocional = val;
    if (hLimpo.includes("ACRESCIMO")) obj.acrescimoAdicional = val;
    if (hLimpo.includes("PRECO") || hLimpo.includes("PREO")) obj.precoItem = val;
    if (hLimpo.includes("SUB") && hLimpo.includes("TOTAL")) obj.subTotal = val;

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
    if (hLimpo.includes("NOTAFISCAL") && hLimpo.includes("FATURADA")) {
      const p = String(val).split("/");
      obj.dataNfFaturada = p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12) : null;
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
