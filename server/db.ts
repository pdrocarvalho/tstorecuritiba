import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, like } from "drizzle-orm";
import {
  users,
  consultores,
  clientes,
  produtos,
  pedidosRastreio,
  syncLogs,
  googleSheetsConfig,
  syncHistory,
  type InsertUser,
  type InsertProduto,
  type InsertPedidoRastreio,
  type InsertSyncLog,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) {
    console.warn("[DB] DATABASE_URL não definida.");
    return null;
  }
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    _db = drizzle(pool);
  } catch (error) {
    console.warn("[DB] Falha ao conectar:", error);
    _db = null;
  }
  return _db;
}

async function requireDb(context: string) {
  const db = await getDb();
  if (!db) throw new Error(`[DB:${context}] Banco de dados indisponível.`);
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("[DB:users] openId é obrigatório.");
  const db = await getDb();
  if (!db) return;
  await db.insert(users).values(user).onConflictDoUpdate({
    target: users.openId,
    set: { name: user.name, email: user.email, lastSignedIn: new Date() },
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

export async function upsertProduto(produto: InsertProduto): Promise<void> {
  const db = await requireDb("produtos");
  await db.insert(produtos).values(produto).onConflictDoUpdate({
    target: produtos.sku,
    set: { descricao: produto.descricao },
  });
}

export async function getPedidosByStatus(status: string) {
  const db = await requireDb("pedidos");
  return db.select().from(pedidosRastreio).where(eq(pedidosRastreio.orderStatus, status as any));
}

export async function getPedidosPendentes() {
  const db = await requireDb("pedidos");
  return db.select().from(pedidosRastreio).where(like(pedidosRastreio.notificationSentStatus, "PENDING_%"));
}

export async function insertPedidoRastreio(pedido: InsertPedidoRastreio) {
  const db = await requireDb("pedidos");
  return db.insert(pedidosRastreio).values(pedido);
}

export async function updatePedidoRastreio(id: number, updates: Partial<InsertPedidoRastreio>): Promise<void> {
  const db = await requireDb("pedidos");
  await db.update(pedidosRastreio).set(updates).where(eq(pedidosRastreio.id, id));
}

export async function getConsultores() {
  const db = await requireDb("consultores");
  return db.select().from(consultores);
}

export async function getClientes() {
  const db = await requireDb("clientes");
  return db.select().from(clientes);
}

export async function getGoogleSheetsConfig() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(googleSheetsConfig).limit(1);
  return result[0] ?? null;
}

export async function saveGoogleSheetsConfig(sheetsUrl: string, configuredBy: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const existing = await getGoogleSheetsConfig();
  if (existing) {
    await db.update(googleSheetsConfig).set({ sheetsUrl }).where(eq(googleSheetsConfig.id, existing.id));
  } else {
    await db.insert(googleSheetsConfig).values({ sheetsUrl, configuredBy });
  }
  return true;
}

export async function recordSyncHistory(params: {
  sheetsUrl: string;
  syncedBy: number;
  novosPedidos: number;
  novasPrevisoes: number;
  chegadas: number;
  status: "sucesso" | "erro";
  mensagemErro?: string;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.insert(syncHistory).values(params);
  return true;
}

export async function insertSyncLog(log: InsertSyncLog): Promise<void> {
  const db = await requireDb("syncLogs");
  await db.insert(syncLogs).values(log);
}