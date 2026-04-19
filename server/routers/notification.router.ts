import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getAllPedidosWithDescricao, getPendingNotifications, updateNotificationStatus, fetchLiveGoogleSheet } from "../engines/sync.engine";
import { generatePendingEmails } from "../engines/notification.engine";
import { sendBulkEmails } from "../services/gmail.service";

export const notificationRouter = router({
  // 🚀 A NOVA ROTA "SOB DEMANDA"
  getLiveData: publicProcedure
    .input(z.object({ url: z.string() }))
    .query(async ({ input }) => {
      if (!input.url || input.url.trim() === "") return [];
      return fetchLiveGoogleSheet(input.url);
    }),

  // Mantemos as rotas antigas abaixo apenas para não quebrar o motor de E-mails
  getPending: publicProcedure.query(async () => {
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

  getHistory: publicProcedure.query(async () => { return []; }),
});