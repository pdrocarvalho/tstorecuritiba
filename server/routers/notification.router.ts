/**
 * server/routers/notification.router.ts
 *
 * Endpoints tRPC para o domínio de notificações.
 * Todos os endpoints requerem usuário autenticado.
 * Envio de notificações é restrito ao role "admin".
 */

import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getPendingNotifications, updateNotificationStatus } from "../engines/sync.engine";
import { generatePendingEmails, markNotificationsAsSent } from "../engines/notification.engine";
import { sendBulkEmails } from "../services/gmail.service";

export const notificationRouter = router({
  /**
   * Lista todos os pedidos com notificação pendente.
   * Usado pelo Dashboard e pelas páginas de Recebimento.
   */
  getPending: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário não autenticado." });
    }

    return getPendingNotifications();
  }),

  /**
   * Envia todas as notificações pendentes agrupadas por consultor/cliente.
   * Restrito a administradores.
   */
  sendPending: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário não autenticado." });
    }

    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Apenas administradores podem enviar notificações.",
      });
    }

    const pendentes = await getPendingNotifications();

    if (pendentes.length === 0) {
      return { success: true, emailsSent: 0, message: "Nenhuma notificação pendente." };
    }

    const emails = await generatePendingEmails();
    const emailsSent = await sendBulkEmails(emails);

    // Marcar como enviado
    for (const pedido of pendentes) {
      const newStatus = pedido.notificationSentStatus.replace("PENDING_", "SENT_");
      await updateNotificationStatus(pedido.id, newStatus);
    }

    return {
      success: true,
      emailsSent,
      message: `${emailsSent} e-mail(s) enviado(s) com sucesso.`,
    };
  }),

  /**
   * Histórico de notificações enviadas.
   * TODO: implementar query no banco.
   */
  getHistory: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário não autenticado." });
    }

    return [];
  }),
});
