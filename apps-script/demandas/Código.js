/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * T STORE CURITIBA — Apps Script: Registro de Demandas
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Estrutura das abas DB-ALERTA_DE_DEMANDA e DB-VENDA_FUTURA:
 *   Linha 1: Título da aba (ignorar)
 *   Linha 2: Cabeçalhos
 *   Linha 3+: Dados
 *
 *   Col A (1) = ID_DEMANDA
 *   Col B (2) = DATA
 *   Col C (3) = CONSULTOR(A)
 *   Col D (4) = CLIENTE
 *   Col E (5) = CONTATO
 *   Col F (6) = REF.
 *   Col G (7) = QTDE.
 *   Col H (8) = STATUS
 *   Col I (9) = THREAD_ID
 *
 * Fluxo:
 *   1. O Node.js (LogisticsAgent) cruza os dados e atualiza a coluna H (STATUS)
 *   2. Este script roda por trigger periódico, detecta status novos e envia e-mails
 *   3. O THREAD_ID é salvo na coluna I para manter as respostas na mesma thread do Gmail
 */

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK (doPost) — Recebe chamadas HTTP POST do backend Node.js
// ═══════════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const result = enviarNotificacaoDemanda(payload);

    // Salva o Thread ID na planilha (Coluna I = 9)
    if (result.threadId) {
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(payload.aba);
        if (sheet && payload.rowNumber) {
          sheet.getRange(payload.rowNumber, 9).setValue(result.threadId); // Coluna I (9) = THREAD_ID
        }
      } catch (err) {
        Logger.log("Erro ao carimbar Thread ID via doPost: " + err);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      threadId: result.threadId
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIGGER — Monitora as planilhas periodicamente (executar via Acionador)
// ═══════════════════════════════════════════════════════════════════════════════

function verificarDemandasEPendentes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abasParaMonitorar = ["DB-ALERTA_DE_DEMANDA", "DB-VENDA_FUTURA"];
  const props = PropertiesService.getScriptProperties();

  for (let a = 0; a < abasParaMonitorar.length; a++) {
    const nomeDaAba = abasParaMonitorar[a];
    const sheet = ss.getSheetByName(nomeDaAba);
    if (!sheet) continue;

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) continue; // Linha 1 = título, Linha 2 = cabeçalhos, Linha 3+ = dados

    // Lê colunas A até I (9 colunas), começando na linha 3 (dados reais)
    const data = sheet.getRange(3, 1, lastRow - 2, 9).getValues();

    for (let i = 0; i < data.length; i++) {
      const rowNumber      = i + 3; // Linha real na planilha
      const idDemanda      = String(data[i][0] || "").trim();           // Col A = ID_DEMANDA
      const dataRegistroRaw = data[i][1];                                // Col B = DATA
      const consultor      = String(data[i][2] || "").trim();           // Col C = CONSULTOR(A)
      const cliente        = String(data[i][3] || "").trim();           // Col D = CLIENTE
      const contato        = String(data[i][4] || "").trim();           // Col E = CONTATO
      const referencia     = String(data[i][5] || "").toUpperCase().trim(); // Col F = REF.
      // data[i][6] = QTDE (não usado diretamente aqui)
      const status         = String(data[i][7] || "").toUpperCase().trim(); // Col H = STATUS
      const threadId       = String(data[i][8] || "").trim();           // Col I = THREAD_ID

      // Ignora linhas sem referência, sem status, ou que ainda estão aguardando
      if (!referencia || !status || status === "AGUARDANDO") continue;

      // Verifica se já notificamos para esse status usando ScriptProperties
      const trackKey = nomeDaAba + "_row" + rowNumber + "_lastStatus";
      const lastNotified = props.getProperty(trackKey) || "";
      if (lastNotified === status) continue; // Já foi notificado para esse estágio

      const tipoDemanda = nomeDaAba === "DB-ALERTA_DE_DEMANDA" ? "ALERTA DE DEMANDA" : "VENDA FUTURA";
      const ehNovoRegistro = !threadId;
      const statusAnterior = lastNotified || null;
      const statusMudou = statusAnterior !== null && statusAnterior !== "" && statusAnterior !== status;

      console.log("Processando " + tipoDemanda + " | Row " + rowNumber + " | REF: " + referencia + " | Status: " + status + " | Novo: " + ehNovoRegistro);

      // Busca informações detalhadas da carga no Banco de Dados do Recebimento
      const dadosCarga = buscarDadosCargaNoBanco(referencia, dataRegistroRaw);

      const resultado = enviarNotificacaoDemanda({
        tipoDemanda: tipoDemanda,
        consultor: consultor,
        cliente: cliente,
        contato: contato,
        referencia: referencia,
        status: status,
        dadosCarga: dadosCarga,
        ehNovoRegistro: ehNovoRegistro,
        statusMudou: statusMudou,
        statusAnterior: statusAnterior,
        threadId: threadId
      });

      if (resultado.sucesso) {
        // Marca como notificado para esse status
        props.setProperty(trackKey, status);

        // Salva o Thread ID na Coluna I (9) apenas no primeiro envio
        if (ehNovoRegistro && resultado.threadId) {
          sheet.getRange(rowNumber, 9).setValue(resultado.threadId); // Coluna I (9) = THREAD_ID
        }

        console.log("✅ E-mail enviado com sucesso para Row " + rowNumber + " | Thread: " + resultado.threadId);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSCA NO BANCO DE DADOS DO RECEBIMENTO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Busca no Banco de Dados de Recebimento os detalhes da carga para a referência.
 * Percorre de baixo para cima para pegar a carga mais recente.
 */
function buscarDadosCargaNoBanco(referencia, dataRegistro) {
  var DEFAULT_RETORNO = { descricao: "-", nf: "-", fornecedor: "-", transportadora: "-", volumes: "-", dataEmbarque: "-", previsao: "-", dataEntrega: "-" };

  try {
    var dbSpreadsheetId = "1uu6N6f21Ct3hXMCbYwUVqK6whSavDVc6ICBsXoeRzyo";
    var dbSpreadsheet = SpreadsheetApp.openById(dbSpreadsheetId);
    var dbSheet = dbSpreadsheet.getSheets()[0];
    var lastRow = dbSheet.getLastRow();

    if (lastRow < 2) return DEFAULT_RETORNO;

    var dbData = dbSheet.getRange(1, 1, lastRow, 15).getValues();

    // De baixo para cima para pegar a carga mais recente
    for (var j = dbData.length - 1; j >= 1; j--) {
      var dbRef = String(dbData[j][0] || "").toUpperCase().trim();

      if (dbRef === referencia) {
        var dataEmbarqueRaw = dbData[j][12]; // Coluna M (Data de Embarque)

        return {
          volumes:        dbData[j][2] || "-",                              // Coluna C
          descricao:      String(dbData[j][3] || "-").toUpperCase(),        // Coluna D
          fornecedor:     String(dbData[j][9] || "-").toUpperCase(),        // Coluna J (Remetente)
          nf:             dbData[j][10] || "-",                             // Coluna K
          transportadora: String(dbData[j][11] || "-").toUpperCase(),       // Coluna L
          dataEmbarque:   formatarDataBr(dataEmbarqueRaw),                  // Coluna M
          previsao:       formatarDataBr(dbData[j][13]),                    // Coluna N
          dataEntrega:    formatarDataBr(dbData[j][14])                     // Coluna O
        };
      }
    }
  } catch (e) {
    console.log("Erro ao buscar dados no Banco de Dados: " + e.message);
  }

  return DEFAULT_RETORNO;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIO DE E-MAIL (usado tanto pelo doPost quanto pelo trigger)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Monta o layout HTML dark mode premium e envia o e-mail.
 * Responde na thread existente (via threadId) ou cria uma nova.
 */
function enviarNotificacaoDemanda(dados) {
  try {
    var destinatarios = "francisco.honorio@tramontinastore.com, contato.cwb@tramontinastore.com";

    // Cores por estágio
    var corEstagio = "#64748b";
    if (dados.status === "FATURADA") corEstagio = "#b45309";
    else if (dados.status === "PREVISÃO" || dados.status === "PREVISAO") corEstagio = "#2563eb";
    else if (dados.status === "CHEGOU") corEstagio = "#16a34a";

    // Assunto padronizado (mantém Thread agrupada corretamente no Gmail)
    var assunto = "[" + dados.tipoDemanda + "] REF " + dados.referencia + " - CONSULTOR: " + (dados.consultor || "").toUpperCase();

    // Helper
    var val = function(v) { return (v && String(v).trim() !== "") ? String(v).toUpperCase() : "—"; };

    var linhaStatusMudou = (dados.statusMudou && dados.statusAnterior) ?
      '<tr>' +
        '<td colspan="2" style="padding: 10px 16px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06);">' +
          '<span style="font-size:10px; font-weight:700; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Alteração de estágio operacional</span><br>' +
          '<span style="font-size:13px; color:#f59e0b; font-weight:700; text-transform:uppercase;">' + dados.statusAnterior + '</span>' +
          '<span style="font-size:13px; color:rgba(255,255,255,0.4); margin:0 8px;">→</span>' +
          '<span style="font-size:13px; color:#4ade80; font-weight:700; text-transform:uppercase;">' + dados.status + '</span>' +
        '</td>' +
      '</tr>' : "";

    // Template Dark Mode Premium
    var htmlBody = '<!DOCTYPE html>' +
'<html lang="pt-BR">' +
'<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
'<body style="margin:0; padding:0; background-color:#0A0F1E; font-family: Arial, Helvetica, sans-serif;">' +
'<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0F1E; padding:32px 16px;">' +
'  <tr><td align="center">' +
'  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">' +
'    <tr>' +
'      <td style="background: linear-gradient(135deg, #1A35A0 0%, #0A0F1E 100%); padding:32px 32px 24px; border-radius:12px 12px 0 0; border-bottom: 1px solid rgba(137,180,222,0.2);">' +
'        <table width="100%" cellpadding="0" cellspacing="0">' +
'          <tr>' +
'            <td>' +
'              <div style="display:inline-block; background:#1A35A0; border:2px solid rgba(137,180,222,0.4); border-radius:8px; width:36px; height:36px; text-align:center; line-height:36px; font-size:18px; font-weight:900; color:#fff; margin-bottom:12px;">T</div>' +
'              <div style="font-size:11px; font-weight:700; color:#89B4DE; letter-spacing:3px; text-transform:uppercase;">T STORE CURITIBA</div>' +
'              <div style="font-size:11px; color:rgba(255,255,255,0.35); letter-spacing:1px; text-transform:uppercase; margin-top:2px;">Gestão Logística Automática</div>' +
'            </td>' +
'            <td align="right" valign="top">' +
'              <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:8px 14px; display:inline-block;">' +
'                <div style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">' + dados.tipoDemanda + '</div>' +
'                <div style="font-size:16px; font-weight:900; color:#fff; letter-spacing:1px;">' + (dados.ehNovoRegistro ? 'NOVO REGISTRO' : 'ATUALIZAÇÃO') + '</div>' +
'              </div>' +
'            </td>' +
'          </tr>' +
'        </table>' +
'      </td>' +
'    </tr>' +
'    <tr>' +
'      <td style="background:#0D1526; padding:20px 32px; border-left:1px solid rgba(137,180,222,0.1); border-right:1px solid rgba(137,180,222,0.1);">' +
'        <table cellpadding="0" cellspacing="0">' +
'          <tr>' +
'            <td style="background:' + corEstagio + '22; border:1px solid ' + corEstagio + '55; border-radius:8px; padding:8px 18px;">' +
'              <span style="font-size:13px; font-weight:800; color:' + corEstagio + '; text-transform:uppercase; letter-spacing:2px;">' + dados.status + '</span>' +
'            </td>' +
'            <td style="padding-left:16px;">' +
'              <div style="font-size:12px; color:rgba(255,255,255,0.5);">Consultor: <strong style="color:rgba(255,255,255,0.8);">' + val(dados.consultor) + '</strong></div>' +
'            </td>' +
'          </tr>' +
'        </table>' +
'      </td>' +
'    </tr>' +
'    <tr>' +
'      <td style="background:#0D1526; padding:0 32px 8px; border-left:1px solid rgba(137,180,222,0.1); border-right:1px solid rgba(137,180,222,0.1);">' +
'        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.06); border-radius:10px; overflow:hidden;">' +
'          <tr>' +
'            <td colspan="2" style="background:rgba(26,53,160,0.3); padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06);">' +
'              <span style="font-size:10px; font-weight:700; color:#89B4DE; text-transform:uppercase; letter-spacing:2px;">Dados do Cliente e Produto</span>' +
'            </td>' +
'          </tr>' +
           linhaStatusMudou +
'          <tr>' +
'            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04); width:50%;">' +
'              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Cliente</span><br>' +
'              <span style="font-size:13px; font-weight:600; color:#fff;">' + val(dados.cliente) + '</span>' +
'            </td>' +
'            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">' +
'              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Contato</span><br>' +
'              <span style="font-size:13px; font-weight:600; color:#fff;">' + val(dados.contato) + '</span>' +
'            </td>' +
'          </tr>' +
'          <tr>' +
'            <td colspan="2" style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">' +
'              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Referência</span><br>' +
'              <span style="font-size:14px; font-weight:700; color:#fff; font-family:monospace; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">' + val(dados.referencia) + '</span>' +
'            </td>' +
'          </tr>' +
'          <tr>' +
'            <td colspan="2" style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">' +
'              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Descrição</span><br>' +
'              <span style="font-size:13px; font-weight:600; color:#fff;">' + val(dados.dadosCarga.descricao) + '</span>' +
'            </td>' +
'          </tr>' +
'          <tr>' +
'            <td colspan="2" style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">' +
'              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Fornecedor/Remetente</span><br>' +
'              <span style="font-size:13px; font-weight:600; color:#fff;">' + val(dados.dadosCarga.fornecedor) + '</span>' +
'            </td>' +
'          </tr>' +
'          <tr>' +
'            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">' +
'              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Nota Fiscal</span><br>' +
'              <span style="font-size:13px; font-weight:600; color:#fff;">' + val(dados.dadosCarga.nf) + '</span>' +
'            </td>' +
'            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">' +
'              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Volumes da Carga</span><br>' +
'              <span style="font-size:13px; font-weight:600; color:#fff;">' + val(dados.dadosCarga.volumes) + '</span>' +
'            </td>' +
'          </tr>' +
'          <tr>' +
'            <td colspan="2" style="padding:10px 16px;">' +
'              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Transportadora</span><br>' +
'              <span style="font-size:13px; font-weight:600; color:#fff;">' + val(dados.dadosCarga.transportadora) + '</span>' +
'            </td>' +
'          </tr>' +
'        </table>' +
'      </td>' +
'    </tr>' +
'    <tr>' +
'      <td style="background:#0D1526; padding:0 32px 16px; border-left:1px solid rgba(137,180,222,0.1); border-right:1px solid rgba(137,180,222,0.1);">' +
'        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(137,180,222,0.2); border-radius:10px; overflow:hidden; background:rgba(26,53,160,0.1);">' +
'          <tr>' +
'            <td colspan="2" style="padding:10px 16px; border-bottom:1px solid rgba(137,180,222,0.15);">' +
'              <span style="font-size:10px; font-weight:700; color:#89B4DE; text-transform:uppercase; letter-spacing:2px;">Cronograma Logístico</span>' +
'            </td>' +
'          </tr>' +
'          <tr>' +
'            <td style="padding:8px 16px; font-size:12px; color:rgba(255,255,255,0.6);">📅 DATA DE EMBARQUE</td>' +
'            <td align="right" style="padding:8px 16px; font-size:13px; font-weight:600; color:#fff;">' + dados.dadosCarga.dataEmbarque + '</td>' +
'          </tr>' +
'          <tr>' +
'            <td style="padding:8px 16px; font-size:12px; color:' + (dados.status !== "FATURADA" ? "#60a5fa" : "rgba(255,255,255,0.6)") + '; font-weight:' + (dados.status !== "FATURADA" ? "700" : "normal") + ';">🚀 PREVISÃO DE ENTREGA</td>' +
'            <td align="right" style="padding:8px 16px; font-size:13px; font-weight:600; color:' + (dados.status !== "FATURADA" ? "#60a5fa" : "#fff") + ';">' + dados.dadosCarga.previsao + '</td>' +
'          </tr>' +
'          <tr>' +
'            <td style="padding:8px 16px; font-size:12px; color:' + (dados.status === "CHEGOU" ? "#4ade80" : "rgba(255,255,255,0.6)") + '; font-weight:' + (dados.status === "CHEGOU" ? "700" : "normal") + ';">✅ DATA DE ENTREGA (CHEGOU)</td>' +
'            <td align="right" style="padding:8px 16px; font-size:13px; font-weight:600; color:' + (dados.status === "CHEGOU" ? "#4ade80" : "#fff") + ';">' + dados.dadosCarga.dataEntrega + '</td>' +
'          </tr>' +
'        </table>' +
'      </td>' +
'    </tr>' +
'    <tr>' +
'      <td style="background:#070B16; padding:20px 32px; border-radius:0 0 12px 12px; border-top:1px solid rgba(137,180,222,0.15); text-align:center;">' +
'        <p style="margin:0; font-size:11px; color:rgba(255,255,255,0.25); text-transform:uppercase; letter-spacing:2px;">' +
'          T Store Curitiba &nbsp;·&nbsp; Inteligência Automatizada de Demandas &nbsp;·&nbsp; ' + Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm") +
'        </p>' +
'      </td>' +
'    </tr>' +
'  </table>' +
'  </td></tr>' +
'</table>' +
'</body>' +
'</html>';

    // ─── ENVIO: responde na thread existente ou cria nova ────────────────────
    var novoThreadId = null;

    if (!dados.ehNovoRegistro && dados.threadId) {
      try {
        var thread = GmailApp.getThreadById(dados.threadId);
        if (thread) {
          var ultimaMensagem = thread.getMessages().pop();
          ultimaMensagem.reply("", { htmlBody: htmlBody });
          novoThreadId = dados.threadId;
          console.log("Respondido na thread " + dados.threadId);
        } else {
          throw new Error("Thread não encontrada");
        }
      } catch(e) {
        console.log("Thread " + dados.threadId + " não encontrada, criando novo e-mail.");
        GmailApp.sendEmail(destinatarios, assunto, "", { htmlBody: htmlBody });
        var threads = GmailApp.search('subject:"' + assunto + '"', 0, 1);
        if (threads.length > 0) novoThreadId = threads[0].getId();
      }
    } else {
      GmailApp.sendEmail(destinatarios, assunto, "", { htmlBody: htmlBody });
      Utilities.sleep(2000); // Aguarda indexação do Gmail
      var threads = GmailApp.search('subject:"' + assunto + '"', 0, 1);
      if (threads.length > 0) novoThreadId = threads[0].getId();
      console.log("Nova thread criada: " + novoThreadId);
    }

    return { sucesso: true, threadId: novoThreadId };
  } catch (e) {
    console.log("Erro ao enviar e-mail de demanda: " + e.message);
    return { sucesso: false, threadId: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normaliza a data para comparações
 */
function parseDataLimpa(dataRaw) {
  if (!dataRaw) return null;
  var d = new Date(dataRaw);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Formata para DD/MM/AAAA
 */
function formatarDataBr(dataRaw) {
  if (!dataRaw) return "-";
  var d = new Date(dataRaw);
  if (isNaN(d.getTime())) return "-";

  var dia = String(d.getDate()).padStart(2, '0');
  var mes = String(d.getMonth() + 1).padStart(2, '0');
  var ano = d.getFullYear();

  return dia + "/" + mes + "/" + ano;
}