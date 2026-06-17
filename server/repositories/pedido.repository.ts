import { eq, like } from "drizzle-orm";
import { pedidosRastreio, type InsertPedidoRastreio } from "../../drizzle/schema";
import { requireDb } from "../db";

export async function getPedidosByStatus(status: string) {
  const db = await requireDb("pedidos");
  return await db.select().from(pedidosRastreio).where(eq(pedidosRastreio.orderStatus, status as any));
}

export async function getPedidosPendentes() {
  const db = await requireDb("pedidos");
  return await db.select().from(pedidosRastreio).where(like(pedidosRastreio.notificationSentStatus, "PENDING_%"));
}

export async function insertPedidoRastreio(pedido: InsertPedidoRastreio) {
  const db = await requireDb("pedidos");
  return await db.insert(pedidosRastreio).values(pedido);
}

export async function updatePedidoRastreio(id: number, updates: Partial<InsertPedidoRastreio>): Promise<void> {
  const db = await requireDb("pedidos");
  await db.update(pedidosRastreio).set(updates).where(eq(pedidosRastreio.id, id));
}
