import { google } from "googleapis";
import { extractSpreadsheetId } from "./sheets-client";
import { getGoogleAuth, parseDataLimpa } from "./google.helpers";
import { fetchDbRecords, DbRecord } from "./cross-reference";
import { DemandaRecord, parseHeaders, mapDemandaRow } from "./sheets-parser";
import { env } from "../_core/env";

export type StatusDemanda = "AGUARDANDO" | "FATURADA" | "PREVISÃO" | "CHEGOU";

const hierarchy = { "AGUARDANDO": 0, "FATURADA": 1, "PREVISÃO": 2, "CHEGOU": 3 };
const getRank = (s: string) => hierarchy[s as keyof typeof hierarchy] || 0;

function determinarStatusDaCarga(carga: DbRecord): StatusDemanda {
  if (carga.dataEntrega && carga.dataEntrega !== "-" && carga.dataEntrega !== "") return "CHEGOU";
  if (carga.previsao && carga.previsao !== "-" && carga.previsao !== "") return "PREVISÃO";
  return "FATURADA";
}

export async function rodarAutomacaoLogistica(urlRecebimento: string, urlDemandas: string) {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // 1. LÊ O BANCO DE DADOS BRUTO E FILTRA CARGAS VÁLIDAS
    const dbRecords = await fetchDbRecords(sheets);

    const demId = extractSpreadsheetId(urlDemandas);
    if (!demId) throw new Error("URL de Demandas inválida");

    // 2. LÊ AS DUAS ABAS DE DEMANDA
    const abas = ["DB-ALERTA_DE_DEMANDA", "DB-VENDA_FUTURA"];
    let allDemands: (DemandaRecord & { aba: string, originalIndex: number, isVenda: boolean })[] = [];

    for (const aba of abas) {
      const demRes = await sheets.spreadsheets.values.get({ spreadsheetId: demId, range: `'${aba}'!A:J` });
      const rows = demRes.data.values || [];
      if (rows.length < 3) continue;

      // A linha 1 é o título da aba; os cabeçalhos reais ficam na linha 2
      const { originais, limpos } = parseHeaders(rows[1]);

      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        const dem = mapDemandaRow(originais, limpos, row, i + 1);
        if (!dem.referencia || !dem.data || String(dem.status).toUpperCase() === "CHEGOU") continue;

        allDemands.push({
          ...dem,
          aba,
          originalIndex: i + 1,
          isVenda: aba === "DB-VENDA_FUTURA",
          dataParseada: parseDataLimpa(dem.data)
        } as any);
      }
    }

    // Filtrar apenas com data válida
    allDemands = allDemands.filter(d => d.dataParseada);

    const conflitos: any[] = [];
    const updatesToApply: any[] = [];
    const webhookPayloads: any[] = [];
    
    let webhookUrl = env.APPS_SCRIPT_WEBHOOK_URL;

    // Agrupar por REF
    const uniqueRefs = Array.from(new Set(allDemands.map(d => String(d.referencia))));

    for (const ref of uniqueRefs) {
      const demandsForRef = allDemands.filter(d => d.referencia === ref);
      
      // Clona os dbRecords daquela referência para podermos deduzir as quantidades localmente
      const shipmentsForRef = dbRecords
        .filter(s => s.ref === ref && s.quantidade > 0)
        .map(s => ({ ...s }));

      if (shipmentsForRef.length === 0) continue; // Sem oferta

      // ORDENAÇÃO: 
      // 1. Status atual (quem já tem alocação - ex: FATURADA - continua tendo prioridade)
      // 2. Prioridade (Venda Futura > Alerta)
      // 3. Data mais antiga (Cronologia)
      demandsForRef.sort((a, b) => {
        const rankA = getRank(String(a.status).toUpperCase());
        const rankB = getRank(String(b.status).toUpperCase());
        if (rankA !== rankB) return rankB - rankA;

        const prioA = a.isVenda ? 1 : 0;
        const prioB = b.isVenda ? 1 : 0;
        if (prioA !== prioB) return prioB - prioA;

        return (a as any).dataParseada.getTime() - (b as any).dataParseada.getTime();
      });

      // ALOCAR DEMANDAS JÁ EM ANDAMENTO (Rank > 0)
      for (const dem of demandsForRef.filter(d => getRank(String(d.status).toUpperCase()) > 0)) {
        const ship = shipmentsForRef.find(s => s.quantidade > 0);
        if (ship) {
          const qty = Number(dem.quantidade) || 1;
          const take = Math.min(qty, ship.quantidade);
          ship.quantidade -= take;
          
          const newStatus = determinarStatusDaCarga(ship);
          const currentRank = getRank(String(dem.status).toUpperCase());
          const newRank = getRank(newStatus);
          
          if (newRank > currentRank) {
            updatesToApply.push({ dem, newStatus, ship });
          }
        }
      }

      // DEMANDAS PENDENTES (Rank === 0 -> AGUARDANDO)
      const remainingVendas = demandsForRef.filter(d => getRank(String(d.status).toUpperCase()) === 0 && d.isVenda);
      const remainingAlertas = demandsForRef.filter(d => getRank(String(d.status).toUpperCase()) === 0 && !d.isVenda);

      const processPending = (group: any[], tipoName: string) => {
        if (group.length === 0) return true;

        // Calcula oferta válida (total de todos os shipments restantes aplicáveis à demanda mais velha desse grupo)
        // Simplificação: apenas soma todos os shipments restantes para bater o total.
        const totalRemainingSupply = shipmentsForRef.reduce((sum, s) => sum + s.quantidade, 0);
        const totalDemandQty = group.reduce((sum, d) => sum + (Number(d.quantidade) || 1), 0);

        if (totalRemainingSupply > 0 && totalRemainingSupply < totalDemandQty) {
          // CONFLITO!
          conflitos.push({
            ref,
            tipo: tipoName,
            demandas: group,
            ofertaDisponivel: totalRemainingSupply,
            cargas: shipmentsForRef.filter(s => s.quantidade > 0)
          });
          return false; // Pausa este nível para esta ref
        }

        // Se tem oferta >= demanda, aloca automaticamente
        for (const dem of group) {
          const ship = shipmentsForRef.find(s => s.quantidade > 0);
          if (ship) {
            const qty = Number(dem.quantidade) || 1;
            const take = Math.min(qty, ship.quantidade);
            ship.quantidade -= take;
            const newStatus = determinarStatusDaCarga(ship);
            updatesToApply.push({ dem, newStatus, ship });
          }
        }
        return true;
      };

      const resolvedVendas = processPending(remainingVendas, "VENDA_FUTURA");
      if (resolvedVendas) {
        processPending(remainingAlertas, "ALERTA_DE_DEMANDA");
      }
    }

    // APLICAR AS ATUALIZAÇÕES AUTOMÁTICAS NO GOOGLE SHEETS
    let updatesApplied = 0;
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    for (const update of updatesToApply) {
      const { dem, newStatus, ship } = update;
      const rowNumber = dem.originalIndex;
      
      // As colunas são: F=REF, G=QTDE, H=STATUS, I=THREAD_ID
      // Vamos atualizar a H (Status)
      await sheets.spreadsheets.values.update({
        spreadsheetId: demId,
        range: `'${dem.aba}'!H${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[newStatus]] }
      });
      
      updatesApplied++;
      
      // Prepara payload para o Webhook do Apps Script
      if (webhookUrl) {
         webhookPayloads.push({
            tipoDemanda: dem.isVenda ? "VENDA FUTURA" : "ALERTA DE DEMANDA",
            consultor: dem.consultor,
            cliente: dem.cliente,
            contato: dem.contato,
            referencia: dem.referencia,
            status: newStatus,
            ehNovoRegistro: !dem.threadId,
            statusMudou: true,
            statusAnterior: String(dem.status).toUpperCase(),
            threadId: dem.threadId || "",
            dadosCarga: {
               descricao: ship.descricao,
               nf: ship.nf,
               fornecedor: ship.fornecedor,
               transportadora: ship.transportadora,
               volumes: ship.volumes,
               dataEmbarque: ship.dataEmbarque ? ship.dataEmbarque.toLocaleDateString('pt-BR') : "-",
               previsao: ship.previsao || "-",
               dataEntrega: ship.dataEntrega || "-"
            },
            aba: dem.aba,
            rowNumber: rowNumber
         });
      }
    }

    // DISPARAR WEBHOOKS EM BACKGROUND
    if (webhookUrl && webhookPayloads.length > 0) {
      Promise.all(webhookPayloads.map(payload => 
        fetch(webhookUrl!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(err => console.log("Erro no Webhook:", err))
      ));
    }

    return {
      success: true,
      updatesApplied,
      conflitos: conflitos,
      mensagem: `Processamento Concluído. ${updatesApplied} estágios evoluídos. ${conflitos.length} conflitos detectados.`
    };

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("[NotificationEngine] Erro geral ao disparar webhook:", error.message);
      throw new Error(`Erro ao rodar automação: ${error.message}`);
    }
    throw new Error("Erro desconhecido ao rodar automação");
  }
}

export async function aplicarResolucaoConflito(urlDemandas: string, resolucoes: any[]) {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const demId = extractSpreadsheetId(urlDemandas);
    if (!demId) throw new Error("URL de Demandas inválida");

    const webhookUrl = env.APPS_SCRIPT_WEBHOOK_URL;

    for (const res of resolucoes) {
      // Atualiza a Coluna H (Status)
      await sheets.spreadsheets.values.update({
        spreadsheetId: demId,
        range: `'${res.aba}'!H${res.rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[res.newStatus]] }
      });

      // Dispara o Webhook se houver payload
      if (webhookUrl && res.payloadWebhook) {
        // Assegura que o status no payload reflita a escolha
        res.payloadWebhook.status = res.newStatus;
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(res.payloadWebhook)
        }).catch(err => console.log("Erro no Webhook da resolução:", err));
      }
    }

    return { success: true, count: resolucoes.length };
  } catch (error: any) {
    throw new Error(`Erro ao aplicar resolução manual: ${error.message}`);
  }
}
