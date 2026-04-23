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
// 🚀 NOTIFICAÇÕES ESPECÍFICAS DE AVARIAS
// =============================================================================

export async function sendAvariaNotification(action: 'CRIADA' | 'EDITADA' | 'EXCLUÍDA', data: any) {
  // Quem recebe o alerta (Defina no Render)
  const recipient = process.env.GMAIL_RECEIVER; 

  if (!recipient) {
    console.error("[GmailService] Variável GMAIL_RECEIVER não configurada. Alerta de avaria não enviado.");
    return false;
  }

  const subject = `🚨 Alerta de Avaria: ${data.codAvaria || data.COD__AVARIA || 'S/N'} - ${action}`;
  
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <h2 style="color: ${action === 'EXCLUÍDA' ? '#dc2626' : '#2563eb'}; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-top: 0;">
        Avaria ${action}
      </h2>
      <div style="padding: 10px 0; line-height: 1.6;">
        <p style="margin: 5px 0;"><strong>Código:</strong> <span style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${data.codAvaria || data.COD__AVARIA || '-'}</span></p>
        <p style="margin: 5px 0;"><strong>Fábrica:</strong> ${data.fabrica || data.FABRICA || data.FÁBRICA || '-'}</p>
        <p style="margin: 5px 0;"><strong>SKU/REF:</strong> ${data.ref || data.REF_ || '-'}</p>
        <p style="margin: 5px 0;"><strong>Quantidade:</strong> <strong style="color: #dc2626;">${data.qtde || data.QTDE_ || '-'}</strong></p>
        <p style="margin: 5px 0;"><strong>Descrição:</strong> ${data.descricao || data.DESCRICAO || data.DESCRIÇÃO || '-'}</p>
        <p style="margin: 5px 0;"><strong>Motivo:</strong> <em>${data.motivo || data.MOTIVO || '-'}</em></p>
        <p style="margin: 5px 0;"><strong>Responsável pela Ação:</strong> ${data.responsavel || data.RESPONSAVEL || data.RESPONSÁVEL || '-'}</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 11px; color: #9ca3af; text-align: center;">Notificação automática gerada pelo Sistema T Store Curitiba.</p>
    </div>
  `;

  // Reaproveita a sua função nativa (sendEmail) para fazer o disparo
  return await sendEmail({
    to: recipient,
    subject: subject,
    html: htmlContent
  });
}