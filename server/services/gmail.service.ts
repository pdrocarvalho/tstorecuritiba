/**
 * server/services/gmail.service.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer");
import type { EmailPayload } from "../engines/notification.engine";

// =============================================================================
// CONFIGURAÇÃO DO TRANSPORTE E DESTINATÁRIOS
// =============================================================================

const EXTRA_EMAILS = [
  "francisco.honorio@tramontinastore.com"
];

function getRecipients(): string {
  const defaultRecipient = process.env.GMAIL_RECEIVER || process.env.GMAIL_USER || "";
  
  const allEmails = [defaultRecipient, ...EXTRA_EMAILS]
    .filter(Boolean)
    .map(email => email.trim().toLowerCase()); // Garante tudo em minúsculo e sem espaços
    
  // Retorna separados por vírgula SEM espaços (padrão mais rígido do Gmail SMTP)
  return Array.from(new Set(allEmails)).join(",");
}

function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error("[GmailService] ❌ ERRO: GMAIL_USER ou GMAIL_APP_PASSWORD não configurados no Render.");
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

// =============================================================================
// ENVIO DE E-MAILS BASE
// =============================================================================

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    const transport = createTransport();
    if (!transport) return false;

    // 🚀 LOG DE PRÉ-ENVIO: Para sabermos o que o robô está tentando fazer
    console.log(`[GmailService] 📧 Tentando enviar e-mail: "${payload.subject}" para: [${payload.to}]`);

    const info = await transport.sendMail({
      from: `"T Store Admin" <${process.env.GMAIL_USER}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    
    console.log(`[GmailService] ✅ Sucesso! ID da mensagem: ${info.messageId}`);
    return true;
  } catch (error: any) {
    // 🚀 LOG DE ERRO SMTP: O Google vai nos dizer aqui por que recusou
    console.error(`[GmailService] ❌ FALHA no envio para ${payload.to}`);
    console.error(`[GmailService] Erro Retornado: ${error.message || error}`);
    return false;
  }
}

export async function sendBulkEmails(emails: EmailPayload[]): Promise<number> {
  if (emails.length === 0) return 0;
  const results = await Promise.allSettled(emails.map(sendEmail));
  const successCount = results.filter(
    (r) => r.status === "fulfilled" && r.value === true
  ).length;
  return successCount;
}

// =============================================================================
// 🚀 NOTIFICAÇÕES DE AVARIAS
// =============================================================================

export async function sendAvariaNotification(action: 'CRIADA' | 'EDITADA' | 'EXCLUÍDA', data: any, previousData?: any) {
  const recipients = getRecipients(); 

  if (!recipients) {
    console.error("[GmailService] ⚠️ Abortado: Sem destinatários para Avarias.");
    return false;
  }

  const subject = `🚨 Alerta de Avaria: ${data.codAvaria || data.COD__AVARIA || 'S/N'} - ${action}`;
  let titleColor = '#2563eb'; 
  const tratativaAtual = String(data.tratativa || data.TRATATIVA || '').toUpperCase().trim();
  
  if (action === 'EXCLUÍDA' || tratativaAtual === 'PENDENTE') titleColor = '#dc2626'; 
  else if (tratativaAtual === 'CONCLUÍDA' || tratativaAtual === 'CONCLUIDA') titleColor = '#16a34a'; 

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
      <h2 style="color: ${titleColor}; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; text-transform: uppercase;">AVARIA ${action}</h2>
      <p>A avaria <strong>${data.codAvaria || data.COD__AVARIA || '-'}</strong> foi atualizada.</p>
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 10px;">
        <p><strong>Referência:</strong> ${data.ref || data.REF_ || '-'}</p>
        <p><strong>Descrição:</strong> ${data.descricao || data.DESCRICAO || '-'}</p>
        <p><strong>Status:</strong> ${data.status || data.STATUS || 'PENDENTE'}</p>
      </div>
    </div>
  `;

  return await sendEmail({ to: recipients, subject, html: htmlContent });
}

// =============================================================================
// 🚀 NOTIFICAÇÕES DE DEMANDAS (ALERTAS E VENDAS)
// =============================================================================

export async function sendDemandaNotification(
  tipo: "ALERTA" | "VENDA",
  estagio: "FATURADO" | "PREVISAO" | "CHEGOU",
  demanda: { consultor: string; cliente: string; contato: string; referencia: string },
  estoque: { notaFiscal?: string; previsao?: string; dataChegada?: string; quantidade?: number }
) {
  const recipients = getRecipients(); 

  if (!recipients) {
    console.warn("[GmailService] ⚠️ Abortado: Sem destinatários para Demandas.");
    return true; 
  }

  const cores = { FATURADO: "#3b82f6", PREVISAO: "#f59e0b", CHEGOU: "#10b981" };
  const corAtual = cores[estagio];
  const tipoTexto = tipo === "ALERTA" ? "Alerta de Demanda" : "Venda Futura";
  
  let tituloEmail = "";
  let mensagemPrincipal = "";

  if (estagio === "FATURADO") {
    tituloEmail = `🧾 Produto Faturado: ${tipoTexto}`;
    mensagemPrincipal = `A referência <strong>${demanda.referencia}</strong> foi faturada (NF: ${estoque.notaFiscal || 'N/A'}), porém ainda sem previsão exata.`;
  } else if (estagio === "PREVISAO") {
    tituloEmail = `🚚 Previsão de Entrega: ${tipoTexto}`;
    mensagemPrincipal = `A referência <strong>${demanda.referencia}</strong> tem previsão para <strong>${estoque.previsao}</strong>.`;
  } else if (estagio === "CHEGOU") {
    tituloEmail = `📦 PRODUTO CHEGOU: ${tipoTexto} 🚀`;
    mensagemPrincipal = `A referência <strong>${demanda.referencia}</strong> chegou no estoque em ${estoque.dataChegada}.`;
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: ${corAtual}; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 24px;">${tituloEmail}</h2>
      </div>
      <div style="padding: 24px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #334155;">Olá <strong>${demanda.consultor}</strong>,<br><br>${mensagemPrincipal}</p>
        <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-left: 4px solid ${corAtual};">
          <p><strong>Cliente:</strong> ${demanda.cliente}</p>
          <p><strong>Referência:</strong> ${demanda.referencia}</p>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({ to: recipients, subject: tituloEmail, html: htmlBody });
}