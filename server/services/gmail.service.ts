/**
 * server/services/gmail.service.ts
 *
 * Serviço de envio de e-mails via Gmail.
 * Utiliza nodemailer com autenticação via App Password.
 *
 * Para usar OAuth2 em produção, substitua o transport por OAuth2.
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
