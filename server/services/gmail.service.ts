/**
 * server/services/gmail.service.ts
 *
 * Serviço de envio de e-mails via Gmail.
 * Utiliza nodemailer com autenticação via App Password.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer");
import type { EmailPayload } from "../engines/notification.engine";

// =============================================================================
// CONFIGURAÇÃO DO TRANSPORTE
// =============================================================================

function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "[GmailService] Variáveis GMAIL_USER e GMAIL_APP_PASSWORD são obrigatórias."
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

// =============================================================================
// ENVIO DE E-MAILS
// =============================================================================

/**
 * Envia um único e-mail.
 * Retorna true em caso de sucesso, false em caso de falha (sem lançar exceção).
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    const transport = createTransport();
    await transport.sendMail({
      from: `"T Store Curitiba" <${process.env.GMAIL_USER}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    return true;
  } catch (error) {
    console.error(`[GmailService] Falha ao enviar e-mail para ${payload.to}:`, error);
    return false;
  }
}

/**
 * Envia múltiplos e-mails em paralelo.
 * Retorna a contagem de e-mails enviados com sucesso.
 */
export async function sendBulkEmails(emails: EmailPayload[]): Promise<number> {
  if (emails.length === 0) return 0;

  const results = await Promise.allSettled(emails.map(sendEmail));

  const successCount = results.filter(
    (r) => r.status === "fulfilled" && r.value === true
  ).length;

  console.log(
    `[GmailService] ${successCount}/${emails.length} e-mail(s) enviado(s) com sucesso.`
  );

  return successCount;
}

// =============================================================================
// 🚀 NOTIFICAÇÕES ESPECÍFICAS DE AVARIAS (MODELO INFO-BLOCKS)
// =============================================================================

export async function sendAvariaNotification(action: 'CRIADA' | 'EDITADA' | 'EXCLUÍDA', data: any, previousData?: any) {
  const recipient = process.env.GMAIL_RECEIVER; 

  if (!recipient) {
    console.error("[GmailService] Variável GMAIL_RECEIVER não configurada. Alerta de avaria não enviado.");
    return false;
  }

  const subject = `🚨 Alerta de Avaria: ${data.codAvaria || data.COD__AVARIA || 'S/N'} - ${action}`;
  
  // 🎨 Lógica de cor dinâmica para o título baseada na tratativa
  let titleColor = '#2563eb'; // Azul (padrão / AGUARDANDO COLETA)
  const tratativaAtual = String(data.tratativa || data.TRATATIVA || '').toUpperCase().trim();
  
  if (action === 'EXCLUÍDA') {
      titleColor = '#dc2626'; // Vermelho se for exclusão
  } else if (tratativaAtual === 'PENDENTE') {
      titleColor = '#dc2626'; // Vermelho
  } else if (tratativaAtual === 'CONCLUÍDA' || tratativaAtual === 'CONCLUIDA') {
      titleColor = '#16a34a'; // Verde
  }

  // Lógica para formatar o texto "De/Para" se houver dados anteriores
  const formatChange = (newValue: any, oldValue: any) => {
    if (action === 'EDITADA' && oldValue !== undefined && newValue !== oldValue) {
      return `De <span style="color: #9ca3af; text-decoration: line-through;">${oldValue || '-'}</span> Para <strong style="color: #166534;">${newValue || '-'}</strong>`;
    }
    return `<strong>${newValue || '-'}</strong>`;
  };

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <h2 style="color: ${titleColor}; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-top: 0; text-transform: uppercase;">
        AVARIA ${action}
      </h2>
      <p style="font-size: 13px;">Olá, a avaria <strong>${data.codAvaria || data.COD__AVARIA || '-'}</strong> foi ${action.toLowerCase()} por ${data.responsavel || data.RESPONSAVEL || '-'}. Veja os detalhes:</p>
      
      <div style="margin: 15px 0; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: #4b5563; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">📦 Informações do Produto</h4>
        <div style="font-size: 13px; line-height: 1.6;">
          <p style="margin: 4px 0;">Código: <strong>${data.codAvaria || data.COD__AVARIA || '-'}</strong></p>
          <p style="margin: 4px 0;">SKU/REF: <strong>${data.ref || data.REF_ || '-'}</strong></p>
          <p style="margin: 4px 0;">Quantidade: ${formatChange(data.qtde || data.QTDE_, previousData?.QTDE_)}</p>
          <p style="margin: 4px 0;">Descrição: <strong>${data.descricao || data.DESCRICAO || '-'}</strong></p>
        </div>
      </div>

      <div style="margin: 15px 0; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: #4b5563; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">⚠️ Detalhes da Avaria</h4>
        <div style="font-size: 13px; line-height: 1.6;">
          <p style="margin: 4px 0;">Fábrica: ${formatChange(data.fabrica || data.FABRICA, previousData?.FABRICA)}</p>
          <p style="margin: 4px 0;">Motivo: <em>${formatChange(data.motivo || data.MOTIVO, previousData?.MOTIVO)}</em></p>
          <p style="margin: 4px 0; margin-top: 8px;">Tratativa Externa: ${formatChange(data.tratativa || data.TRATATIVA || 'PENDENTE', previousData?.TRATATIVA)}</p>
          <p style="margin: 4px 0;">Status Interno: ${formatChange(data.status || data.STATUS || 'PENDENTE', previousData?.STATUS)}</p>
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 11px; color: #9ca3af; text-align: center;">Notificação automática gerada pelo Sistema T Store Curitiba.</p>
    </div>
  `;

  return await sendEmail({
    to: recipient,
    subject: subject,
    html: htmlContent
  });
}