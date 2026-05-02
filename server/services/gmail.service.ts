/**
 * server/services/gmail.service.ts
 * * ⚠️ NOTA: Este serviço foi desativado localmente. 
 * O disparo de e-mails agora é realizado pelo Google Apps Script 
 * diretamente na planilha (Gatilho: Ao Alterar Coluna F).
 */

import type { EmailPayload } from "../engines/notification.engine";

// Removemos a importação do Resend para limpar o código
// const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  // Apenas logamos no terminal para fins de monitoramento, sem disparar nada.
  console.log(`[Service] ℹ️ Notificação processada: "${payload.subject}". (Envio via Apps Script na Planilha)`);
  
  // Retornamos true para o motor achar que deu tudo certo e seguir o fluxo.
  return true; 
}

export async function sendBulkEmails(emails: EmailPayload[]): Promise<number> {
  if (emails.length === 0) return 0;
  console.log(`[Service] ℹ️ Processando lote de ${emails.length} notificações.`);
  return emails.length;
}

// -----------------------------------------------------------------------------
// As funções abaixo permanecem para manter a compatibilidade, 
// mas agora elas apenas avisam o sistema.
// -----------------------------------------------------------------------------

export async function sendAvariaNotification(action: string, data: any) {
  console.log(`[Service] ℹ️ Log de Avaria: ${data.codAvaria || 'S/N'} - ${action}`);
  return true;
}

export async function sendDemandaNotification(tipo: string, estagio: string, demanda: any, estoque: any) {
  console.log(`[Service] ℹ️ Log de Demanda: ${demanda.referencia} mudou para ${estagio}`);
  return true;
}