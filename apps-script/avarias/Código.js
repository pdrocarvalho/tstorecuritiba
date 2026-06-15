/**
 * Apps Script - T Store Curitiba
 * Monitora mudanças na planilha de Avarias e envia e-mails automáticos.
 * 
 * MAPEAMENTO DE COLUNAS:
 * A(1)  Data de Entrada    B(2)  Fábrica           C(3)  Cód. Avaria
 * D(4)  Referência         E(5)  Descrição          F(6)  Quantidade
 * G(7)  NF Entrada         H(8)  Cupom Fiscal       I(9)  Motivo
 * J(10) Responsável        K(11) Lançado no Sistema  L(12) Tratativa (Macro)
 * M(13) Consta Fisicamente N(14) Data Coleta        O(15) NF Saída
 * P(16) NF Reposição       Q(17) Status Operacional  R(18) Carimbo (controle)
 * S(19) Observações        T(20) Thread ID (e-mail)
 */

function verificarAvariasEPendentes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  const data = sheet.getRange(1, 1, lastRow, 20).getValues();

  for (let i = 1; i < data.length; i++) {
    const codAvaria  = String(data[i][2]  || "").trim(); // C
    const status     = String(data[i][16] || "").toUpperCase().trim(); // Q
    const carimbo    = String(data[i][17] || "").trim(); // R
    const threadId   = String(data[i][19] || "").trim(); // T

    if (!codAvaria || !status) continue;

    if (carimbo !== "OK_" + status) {
      const ehNovoRegistro = carimbo === "" && !threadId;
      const statusAnterior = carimbo.startsWith("OK_") ? carimbo.replace("OK_", "") : null;
      const statusMudou    = statusAnterior !== null && statusAnterior !== status;

      console.log(`Linha ${i + 1} | Cod: ${codAvaria} | Status: ${status} | Novo: ${ehNovoRegistro} | ThreadId: ${threadId || "nenhum"}`);

      const resultado = enviarNotificacaoAvaria(sheet, i + 1, status, ehNovoRegistro, statusMudou, statusAnterior, threadId);

      if (resultado.sucesso) {
        sheet.getRange(i + 1, 18).setValue("OK_" + status);

        // Salva o threadId na Coluna T somente no primeiro envio
        if (ehNovoRegistro && resultado.threadId) {
          sheet.getRange(i + 1, 20).setValue(resultado.threadId);
        }
      }
    }
  }
}

function enviarNotificacaoAvaria(sheet, row, status, ehNovoRegistro, statusMudou, statusAnterior, threadId) {
  try {
    const dataEntrada  = sheet.getRange(row, 1).getValue();
    const fabrica      = sheet.getRange(row, 2).getValue();
    const codAvaria    = sheet.getRange(row, 3).getValue();
    const referencia   = sheet.getRange(row, 4).getValue();
    const descricao    = sheet.getRange(row, 5).getValue();
    const quantidade   = sheet.getRange(row, 6).getValue();
    const nfEntrada    = sheet.getRange(row, 7).getValue();
    const cupomFiscal  = sheet.getRange(row, 8).getValue();
    const motivo       = sheet.getRange(row, 9).getValue();
    const responsavel  = sheet.getRange(row, 10).getValue();
    const lancadoSist  = sheet.getRange(row, 11).getValue();
    const tratativa    = sheet.getRange(row, 12).getValue();
    const constaFis    = sheet.getRange(row, 13).getValue();
    const dataColeta   = sheet.getRange(row, 14).getValue();
    const nfSaida      = sheet.getRange(row, 15).getValue();
    const nfReposicao  = sheet.getRange(row, 16).getValue();
    const observacao   = sheet.getRange(row, 19).getValue();

    const destinatarios = "francisco.honorio@tramontinastore.com, contato.cwb@tramontinastore.com";

    // ─── ASSUNTO ─────────────────────────────────────────────────────────────
    let assunto = "";
    if (ehNovoRegistro) {
      assunto = `REGISTRO DE AVARIA | ${codAvaria} — ${fabrica}`;
    } else if (statusMudou) {
      assunto = `AVARIA ${codAvaria} | STATUS ALTERADO: ${statusAnterior} → ${status}`;
    } else {
      assunto = `AVARIA ${codAvaria} | DADOS ATUALIZADOS — ${fabrica}`;
    }

    // ─── COR DO STATUS ────────────────────────────────────────────────────────
    let corStatus = "#64748b";
    if (status === "AGUARDANDO TRATATIVA")              corStatus = "#f59e0b";
    else if (status === "AGUARDANDO COLETA")            corStatus = "#f97316";
    else if (status === "AGUARDANDO REPOSIÇÃO")         corStatus = "#8b5cf6";
    else if (status === "AGUARDANDO AJUSTE DE ESTOQUE") corStatus = "#06b6d4";
    else if (status === "FINALIZADO")                   corStatus = "#16a34a";

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    const val = (v) => (v && String(v).trim() !== "") ? String(v).toUpperCase() : "—";
    const dataFmt = (v) => {
      if (!v) return "—";
      try {
        if (typeof v === "string" && v.includes("/")) return v.trim();
        return Utilities.formatDate(new Date(v), "America/Sao_Paulo", "dd/MM/yyyy");
      } catch(e) { return String(v); }
    };

    // ─── LINHA DE STATUS ALTERADO ─────────────────────────────────────────────
    const linhaStatusMudou = (statusMudou && statusAnterior) ? `
      <tr>
        <td colspan="2" style="padding: 10px 16px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06);">
          <span style="font-size:10px; font-weight:700; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Alteração de status</span><br>
          <span style="font-size:13px; color:#f59e0b; font-weight:700; text-transform:uppercase;">${statusAnterior}</span>
          <span style="font-size:13px; color:rgba(255,255,255,0.4); margin:0 8px;">→</span>
          <span style="font-size:13px; color:#4ade80; font-weight:700; text-transform:uppercase;">${status}</span>
        </td>
      </tr>` : "";

    // ─── HTML DO E-MAIL ───────────────────────────────────────────────────────
    const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#0A0F1E; font-family: Arial, Helvetica, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0F1E; padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
    <tr>
      <td style="background: linear-gradient(135deg, #1A35A0 0%, #0A0F1E 100%); padding:32px 32px 24px; border-radius:12px 12px 0 0; border-bottom: 1px solid rgba(137,180,222,0.2);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="display:inline-block; background:#1A35A0; border:2px solid rgba(137,180,222,0.4); border-radius:8px; width:36px; height:36px; text-align:center; line-height:36px; font-size:18px; font-weight:900; color:#fff; margin-bottom:12px;">T</div>
              <div style="font-size:11px; font-weight:700; color:#89B4DE; letter-spacing:3px; text-transform:uppercase;">T STORE CURITIBA</div>
              <div style="font-size:11px; color:rgba(255,255,255,0.35); letter-spacing:1px; text-transform:uppercase; margin-top:2px;">Gestão Logística Automática</div>
            </td>
            <td align="right" valign="top">
              <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:8px 14px; display:inline-block;">
                <div style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">${ehNovoRegistro ? 'Novo Registro' : 'Atualização'}</div>
                <div style="font-size:18px; font-weight:900; color:#fff; letter-spacing:1px;">${codAvaria}</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#0D1526; padding:20px 32px; border-left:1px solid rgba(137,180,222,0.1); border-right:1px solid rgba(137,180,222,0.1);">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:${corStatus}22; border:1px solid ${corStatus}55; border-radius:8px; padding:8px 18px;">
              <span style="font-size:13px; font-weight:800; color:${corStatus}; text-transform:uppercase; letter-spacing:2px;">${status}</span>
            </td>
            <td style="padding-left:16px;">
              <div style="font-size:12px; color:rgba(255,255,255,0.5);">Unidade: <strong style="color:rgba(255,255,255,0.8);">${val(fabrica)}</strong></div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#0D1526; padding:0 32px 8px; border-left:1px solid rgba(137,180,222,0.1); border-right:1px solid rgba(137,180,222,0.1);">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.06); border-radius:10px; overflow:hidden;">
          <tr>
            <td colspan="2" style="background:rgba(26,53,160,0.3); padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="font-size:10px; font-weight:700; color:#89B4DE; text-transform:uppercase; letter-spacing:2px;">Dados do Produto</span>
            </td>
          </tr>
          ${linhaStatusMudou}
          <tr>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04); width:40%;">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Referência</span><br>
              <span style="font-size:14px; font-weight:700; color:#fff; font-family:monospace;">${val(referencia)}</span>
            </td>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Quantidade</span><br>
              <span style="font-size:14px; font-weight:700; color:#fff;">${val(quantidade)}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Descrição</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${val(descricao)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">NF de Entrada</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${val(nfEntrada)}</span>
            </td>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Cupom Fiscal</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${val(cupomFiscal)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Motivo</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${val(motivo)}</span>
            </td>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Responsável</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${val(responsavel)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Tratativa (Macro)</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${val(tratativa)}</span>
            </td>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Data de Entrada</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${dataFmt(dataEntrada)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Consta Fisicamente</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${val(constaFis)}</span>
            </td>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Lançado no Sistema</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${val(lancadoSist)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">Data de Coleta</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${dataFmt(dataColeta)}</span>
            </td>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">NF de Saída</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${val(nfSaida)}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:10px 16px;">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px;">NF de Reposição</span><br>
              <span style="font-size:13px; font-weight:600; color:#fff;">${val(nfReposicao)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${observacao ? `
    <tr>
      <td style="background:#0D1526; padding:0 32px 16px; border-left:1px solid rgba(137,180,222,0.1); border-right:1px solid rgba(137,180,222,0.1);">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(137,180,222,0.2); border-radius:10px; overflow:hidden; background:rgba(26,53,160,0.1);">
          <tr>
            <td style="padding:10px 16px; border-bottom:1px solid rgba(137,180,222,0.15);">
              <span style="font-size:10px; font-weight:700; color:#89B4DE; text-transform:uppercase; letter-spacing:2px;">Observações</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 16px;">
              <span style="font-size:13px; color:rgba(255,255,255,0.8); line-height:1.6; text-transform:uppercase;">${String(observacao).toUpperCase()}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''}
    <tr>
      <td style="background:#070B16; padding:20px 32px; border-radius:0 0 12px 12px; border-top:1px solid rgba(137,180,222,0.15); text-align:center;">
        <p style="margin:0; font-size:11px; color:rgba(255,255,255,0.25); text-transform:uppercase; letter-spacing:2px;">
          T Store Curitiba &nbsp;·&nbsp; Gestão Logística Automática &nbsp;·&nbsp; ${Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm")}
        </p>
      </td>
    </tr>
  </table>
  </td></tr>
</table>
</body>
</html>`;

    // ─── ENVIO: responde na thread existente ou cria nova ────────────────────
    let novoThreadId = null;

    if (!ehNovoRegistro && threadId) {
      // Edição com thread salva — responde na mesma conversa
      try {
        const thread = GmailApp.getThreadById(threadId);
        if (thread) {
          const ultimaMensagem = thread.getMessages().pop();
          ultimaMensagem.reply("", { htmlBody: htmlBody });
          novoThreadId = threadId; // mantém o mesmo
          console.log(`Respondido na thread ${threadId}`);
        } else {
          throw new Error("Thread não encontrada");
        }
      } catch(e) {
        // Thread não encontrada — cria novo e-mail normalmente
        console.log(`Thread ${threadId} não encontrada, criando novo e-mail.`);
        const enviado = GmailApp.sendEmail(destinatarios, assunto, "", { htmlBody: htmlBody });
        const threads = GmailApp.search(`subject:"${assunto}"`, 0, 1);
        if (threads.length > 0) novoThreadId = threads[0].getId();
      }
    } else {
      // Novo registro — cria a thread e salva o ID
      GmailApp.sendEmail(destinatarios, assunto, "", { htmlBody: htmlBody });
      // Aguarda um instante para o e-mail ser indexado
      Utilities.sleep(2000);
      const threads = GmailApp.search(`subject:"REGISTRO DE AVARIA | ${codAvaria}"`, 0, 1);
      if (threads.length > 0) novoThreadId = threads[0].getId();
      console.log(`Nova thread criada: ${novoThreadId}`);
    }

    return { sucesso: true, threadId: novoThreadId };

  } catch (e) {
    console.log("Erro no envio de avaria: " + e.message);
    return { sucesso: false, threadId: null };
  }
}