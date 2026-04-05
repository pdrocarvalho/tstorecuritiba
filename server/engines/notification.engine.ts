/**
 * server/engines/notification.engine.ts
 *
 * Motor de notificações por e-mail.
 * Agrupa pedidos pendentes por consultor + cliente + fase para evitar spam.
 * Gera os e-mails HTML e marca os pedidos como enviados.
 */

import { eq } from "drizzle-orm";
import {
  getPedidosPendentes,
  updatePedidoRastreio,
  getConsultores,
  getClientes,
  getDb,
} from "../db";
import { produtos } from "../../drizzle/schema";
import type { OrderStatus } from "../../drizzle/schema";

// =============================================================================
// TIPOS
// =============================================================================

export interface NotificationItem {
  sku: string;
  descricao: string;
  quantidade: number;
  previsaoEntrega: Date | null;
}

export interface NotificationGroup {
  consultorId: number | null;
  consultorNome: string;
  consultorEmail: string;
  clienteId: number | null;
  clienteNome: string;
  orderStatus: OrderStatus;
  items: NotificationItem[];
  pedidoIds: number[];
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

// =============================================================================
// AGRUPAMENTO
// =============================================================================

/**
 * Agrupa pedidos pendentes por (consultor, cliente, fase).
 * Ignora pedidos sem consultor ou cliente cadastrado.
 */
export async function groupNotificationsByConsultorAndClient(): Promise<NotificationGroup[]> {
  const [pendentes, consultoresList, clientesList] = await Promise.all([
    getPedidosPendentes(),
    getConsultores(),
    getClientes(),
  ]);

  const db = await getDb();
  if (!db) throw new Error("[NotificationEngine] Banco de dados indisponível.");

  const groups = new Map<string, NotificationGroup>();

  for (const pedido of pendentes) {
    const consultor = consultoresList.find((c) => c.id === pedido.consultorId);
    const cliente = clientesList.find((c) => c.id === pedido.clienteId);

    if (!consultor || !cliente) continue;

    const produtoResult = await db
      .select()
      .from(produtos)
      .where(eq(produtos.sku, pedido.produtoSku));

    const produto = produtoResult[0];
    const groupKey = `${pedido.consultorId}_${pedido.clienteId}_${pedido.orderStatus}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        consultorId: pedido.consultorId,
        consultorNome: consultor.nome,
        consultorEmail: consultor.email,
        clienteId: pedido.clienteId,
        clienteNome: cliente.nome,
        orderStatus: pedido.orderStatus as OrderStatus,
        items: [],
        pedidoIds: [],
      });
    }

    const group = groups.get(groupKey)!;
    group.items.push({
      sku: pedido.produtoSku,
      descricao: produto?.descricao ?? "Produto desconhecido",
      quantidade: pedido.quantidade,
      previsaoEntrega: pedido.previsaoEntrega,
    });
    group.pedidoIds.push(pedido.id);
  }

  return Array.from(groups.values());
}

// =============================================================================
// GERAÇÃO DE E-MAILS
// =============================================================================

export function formatDateToPT(date: Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function buildEmailSubject(
  consultorNome: string,
  clienteNome: string,
  status: OrderStatus
): string {
  const label: Record<OrderStatus, string> = {
    Faturado: "Faturado",
    Previsto: "Previsão",
    Chegou: "Chegou",
  };
  return `[${label[status]}] CONSULTOR(A): ${consultorNome} — CLIENTE: ${clienteNome}`;
}

function buildEmailMessage(
  consultorNome: string,
  clienteNome: string,
  status: OrderStatus,
  items: NotificationItem[]
): string {
  const previsao = formatDateToPT(items[0]?.previsaoEntrega ?? null);

  const messages: Record<OrderStatus, string> = {
    Faturado: `Olá, <strong>${consultorNome}</strong>! Você tem uma notificação sobre a Venda Futura do(a) cliente <strong>${clienteNome}</strong>.`,
    Previsto: `Olá, <strong>${consultorNome}</strong>! Você tem uma notificação sobre a Venda Futura do(a) cliente <strong>${clienteNome}</strong>. A previsão de entrega é para <strong>${previsao}</strong>.`,
    Chegou: `Olá, <strong>${consultorNome}</strong>! Sua Venda Futura do(a) cliente <strong>${clienteNome}</strong> chegou!`,
  };

  return messages[status];
}

function buildItemsTableHtml(items: NotificationItem[]): string {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="border:1px solid #ddd;padding:8px;">${item.sku}</td>
        <td style="border:1px solid #ddd;padding:8px;">${item.descricao}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:center;">${item.quantidade}</td>
      </tr>`
    )
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <thead>
        <tr style="background-color:#f2f2f2;">
          <th style="border:1px solid #ddd;padding:8px;text-align:left;">Referência</th>
          <th style="border:1px solid #ddd;padding:8px;text-align:left;">Descrição</th>
          <th style="border:1px solid #ddd;padding:8px;text-align:center;">Quantidade</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildEmailHtml(
  consultorNome: string,
  clienteNome: string,
  status: OrderStatus,
  items: NotificationItem[]
): string {
  const message = buildEmailMessage(consultorNome, clienteNome, status, items);
  const itemsTable = buildItemsTableHtml(items);

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notificação — T Store Curitiba</title>
    </head>
    <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;">
      <div style="width:80%;margin:20px auto;border:1px solid #ddd;padding:20px;border-radius:8px;">
        <div style="background-color:#f4f4f4;padding:12px;text-align:center;border-bottom:1px solid #ddd;">
          <h2 style="margin:0;">Notificação — T Store Curitiba</h2>
        </div>
        <div style="padding:20px 0;">
          <p>${message}</p>
          <p>Detalhes dos itens:</p>
          ${itemsTable}
        </div>
        <div style="text-align:center;font-size:0.8em;color:#777;border-top:1px solid #ddd;padding-top:10px;margin-top:20px;">
          <p>Este é um e-mail automático. Por favor, não responda.</p>
        </div>
      </div>
    </body>
    </html>`;
}

// =============================================================================
// GERAÇÃO E MARCAÇÃO
// =============================================================================

/** Gera os payloads de e-mail para todos os grupos pendentes. */
export async function generatePendingEmails(): Promise<EmailPayload[]> {
  const groups = await groupNotificationsByConsultorAndClient();

  return groups.map((group) => ({
    to: group.consultorEmail,
    subject: buildEmailSubject(group.consultorNome, group.clienteNome, group.orderStatus),
    html: buildEmailHtml(group.consultorNome, group.clienteNome, group.orderStatus, group.items),
  }));
}

/** Marca os pedidos como enviados (SENT_<FASE>). */
export async function markNotificationsAsSent(
  pedidoIds: number[],
  status: OrderStatus
): Promise<void> {
  const newStatus = `SENT_${status.toUpperCase()}`;

  await Promise.all(
    pedidoIds.map((id) =>
      updatePedidoRastreio(id, { notificationSentStatus: newStatus })
    )
  );
}
