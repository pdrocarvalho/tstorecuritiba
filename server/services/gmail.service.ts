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

export async function sendAvariaNotification(action: 'CRIADA' | 'EDITADA' | 'EXCLUÍDA', data: any, previousData?: any) {
  const recipient = process.env.GMAIL_RECEIVER; 

  if (!recipient) {
    console.error("[GmailService] Variável GMAIL_RECEIVER não configurada. Alerta de avaria não enviado.");
    return false;
  }

  const subject = `🚨 Alerta de Avaria: ${data.codAvaria || data.COD__AVARIA || 'S/N'} - ${action}`;
  
  // 🎨 Lógica de cor dinâmica
  let titleColor = '#2563eb'; 
  const tratativaAtual = String(data.tratativa || data.TRATATIVA || '').toUpperCase().trim();
  
  if (action === 'EXCLUÍDA') {
      titleColor = '#dc2626'; 
  } else if (tratativaAtual === 'PENDENTE') {
      titleColor = '#dc2626'; 
  } else if (tratativaAtual === 'CONCLUÍDA' || tratativaAtual === 'CONCLUIDA') {
      titleColor = '#16a34a'; 
  }

  // 🚀 LÓGICA DE RESUMO DE ALTERAÇÕES
  let changesSummaryHtml = "";
  if (action === 'EDITADA' && previousData) {
    const changes: string[] = [];
    
    const compareAndAdd = (label: string, newVal: any, oldVal: any) => {
      const n = String(newVal || '').trim();
      const o = String(oldVal || '').trim();
      if (n !== o) {
         changes.push(`<li style="margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed #d1d5db;">Editado o campo <strong>${label}</strong>:<br> De: <span style="color: #6b7280; text-decoration: line-through;">${o || '(Vazio)'}</span> &rarr; Para: <strong style="color: #15803d;">${n || '(Vazio)'}</strong></li>`);
      }
    };

    compareAndAdd("Quantidade", data.qtde || data.QTDE_, previousData.QTDE_);
    compareAndAdd("Fábrica", data.fabrica || data.FABRICA, previousData.FABRICA);
    compareAndAdd("SKU/REF", data.ref || data.REF_, previousData.REF_);
    compareAndAdd("Descrição", data.descricao || data.DESCRICAO, previousData.DESCRICAO);
    compareAndAdd("Motivo", data.motivo || data.MOTIVO, previousData.MOTIVO);
    compareAndAdd("Origem da Demanda", data.responsavel || data.RESPONSAVEL, previousData.RESPONSAVEL);
    compareAndAdd("Tratativa Externa", data.tratativa || data.TRATATIVA, previousData.TRATATIVA);
    compareAndAdd("Status Interno", data.status || data.STATUS, previousData.STATUS);

    if (changes.length > 0) {
       changesSummaryHtml = `
         <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; margin: 20px 0; border-radius: 8px;">
           <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; color: #166534; text-transform: uppercase;">✅ Resumo de Alterações:</p>
           <ul style="margin: 0; padding-left: 0; font-size: 13px; color: #374151; line-height: 1.6; list-style-type: none;">
             ${changes.join('')}
           </ul>
         </div>
       `;
    }
  }

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
      <p style="font-size: 13px; line-height: 1.5;">Olá, a avaria <strong>${data.codAvaria || data.COD__AVARIA || '-'}</strong> sofreu a seguinte ação no sistema: <strong style="color: ${titleColor};">${action}</strong>.</p>
      ${changesSummaryHtml}
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
      <div style="margin: 15px 0; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: #4b5563; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">👤 Origem da Demanda</h4>
        <div style="font-size: 13px; line-height: 1.6;">
          <p style="margin: 4px 0;">Identificada por: ${formatChange(data.responsavel || data.RESPONSAVEL, previousData?.RESPONSAVEL)}</p>
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

// =============================================================================
// 🚀 NOTIFICAÇÕES ESPECÍFICAS DE DEMANDAS (ALERTAS E VENDAS)
// =============================================================================

export async function sendDemandaNotification(
  tipo: "ALERTA" | "VENDA",
  estagio: "FATURADO" | "PREVISAO" | "CHEGOU",
  demanda: { consultor: string; cliente: string; contato: string; referencia: string },
  estoque: { notaFiscal?: string; previsao?: string; dataChegada?: string; quantidade?: number }
) {
  const recipient = process.env.GMAIL_RECEIVER; 

  if (!recipient) {
    console.error("[GmailService] Variável GMAIL_RECEIVER não configurada. E-mail de Demanda não enviado.");
    return false;
  }

  // Configuração visual das cores baseada no estágio
  const cores = {
    FATURADO: "#3b82f6", // Azul
    PREVISAO: "#f59e0b", // Amarelo/Laranja
    CHEGOU: "#10b981"    // Verde
  };

  const corAtual = cores[estagio];
  const tipoTexto = tipo === "ALERTA" ? "Alerta de Demanda" : "Venda Futura";
  
  let tituloEmail = "";
  let mensagemPrincipal = "";

  if (estagio === "FATURADO") {
    tituloEmail = `🧾 Produto Faturado: ${tipoTexto}`;
    mensagemPrincipal = `A referência <strong>${demanda.referencia}</strong> foi faturada e consta em nosso sistema (NF: ${estoque.notaFiscal || 'N/A'}), porém ainda <strong>não possui previsão exata de entrega</strong>. Fique atento às próximas atualizações!`;
  } else if (estagio === "PREVISAO") {
    tituloEmail = `🚚 Previsão de Entrega: ${tipoTexto}`;
    mensagemPrincipal = `Ótimas notícias! A referência <strong>${demanda.referencia}</strong> ganhou uma previsão de entrega. A data estimada para chegada no estoque é <strong>${estoque.previsao}</strong>.`;
  } else if (estagio === "CHEGOU") {
    tituloEmail = `📦 PRODUTO CHEGOU: ${tipoTexto} 🚀`;
    mensagemPrincipal = `O produto já está fisicamente na loja! A referência <strong>${demanda.referencia}</strong> acabou de dar entrada no estoque (Data: ${estoque.dataChegada}). Já pode avisar o cliente!`;
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: ${corAtual}; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 24px;">${tituloEmail}</h2>
      </div>
      
      <div style="padding: 24px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #334155; line-height: 1.5;">
          Olá <strong>${demanda.consultor}</strong>,<br><br>
          ${mensagemPrincipal}
        </p>

        <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-left: 4px solid ${corAtual}; border-radius: 4px;">
          <h3 style="margin-top: 0; margin-bottom: 12px; color: #0f172a; font-size: 16px;">Detalhes do Cliente:</h3>
          <p style="margin: 4px 0; color: #475569;"><strong>Nome:</strong> ${demanda.cliente}</p>
          <p style="margin: 4px 0; color: #475569;"><strong>Contato:</strong> ${demanda.contato || 'Não informado'}</p>
          <p style="margin: 4px 0; color: #475569;"><strong>Referência:</strong> ${demanda.referencia}</p>
        </div>

        ${estoque.quantidade ? `<p style="margin-top: 16px; font-size: 14px; color: #64748b;">Quantidade detectada no sistema: ${estoque.quantidade} un.</p>` : ''}
        
        <p style="margin-top: 30px; font-size: 14px; color: #94a3b8; text-align: center;">
          Este é um e-mail automático do seu Sistema de Gestão de Estoque.
        </p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: recipient,
    subject: tituloEmail,
    html: htmlBody
  });
}