import { publicProcedure, router } from "../_core/trpc";
import { getAllPedidosWithDescricao, getPendingNotifications, updateNotificationStatus } from "../engines/sync.engine";
import { generatePendingEmails } from "../engines/notification.engine";
import { sendBulkEmails } from "../services/gmail.service";

export const notificationRouter = router({
  getPending: publicProcedure.query(async () => {
    // Agora enviamos TODOS os produtos para a listagem/dashboard em vez de apenas os pendentes!
    return getAllPedidosWithDescricao();
  }),

  sendPending: publicProcedure.mutation(async () => {
    const pendentes = await getPendingNotifications();
    if (pendentes.length === 0) {
      return { success: true, emailsSent: 0, message: "Nenhuma notificação pendente." };
    }
    const emails = await generatePendingEmails();
    const emailsSent = await sendBulkEmails(emails);
    
    for (const pedido of pendentes) {
      const newStatus = pedido.notificationSentStatus.replace("PENDING_", "SENT_");
      await updateNotificationStatus(pedido.id, newStatus);
    }
    return { success: true, emailsSent, message: `${emailsSent} e-mail(s) enviado(s).` };
  }),

  getHistory: publicProcedure.query(async () => {
    return [];
  }),
});