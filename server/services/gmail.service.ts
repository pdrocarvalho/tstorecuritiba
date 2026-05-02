/**
 * server/services/gmail.service.ts
 * ⚠️ NOTA: Este serviço foi desativado. 
 * O disparo de e-mails agora é realizado pelo Google Apps Script.
 */

// Definimos a interface aqui para evitar erro de importação do engine
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  // Apenas log informativo no Render
  console.log(`[Service Log] Notificação processada: "${payload.subject}". (Envio via Planilha)`);
  return true; 
}

export async function sendBulkEmails(emails: EmailPayload[]): Promise<number> {
  if (emails.length === 0) return 0;
  console.log(`[Service Log] Processando lote de ${emails.length} notificações.`);
  return emails.length;
}

export async function sendAvariaNotification(action: string, data: any) {
  console.log(`[Service Log] Avaria ${action}: ${data.codAvaria || 'S/N'}`);
  return true;
}

export async function sendDemandaNotification(tipo: string, estagio: string, demanda: any, estoque: any) {
  console.log(`[Service Log] Demanda ${demanda.referencia}: ${estagio}`);
  return true;
}