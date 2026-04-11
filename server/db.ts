import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, like } from "drizzle-orm";
import {
  users, consultores, clientes, produtos, pedidosRastreio,
  syncLogs, googleSheetsConfig, syncHistory,
  type InsertUser, type InsertProduto, type InsertPedidoRastreio, type InsertSyncLog,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) {
    console.warn("[DB] DATABASE_URL não definida.");
    return null;
  }
  try {
    // Limpa parâmetros extras (como sslmode) para o Render não dar conflito com o código
    let connString = process.env.DATABASE_URL;
    if (connString.includes("?")) {
      connString = connString.split("?")[0];
    }
    
    const isSupabase = connString.includes("supabase");
    
    const pool = new Pool({ 
      connectionString: connString,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    });
    _db = drizzle(pool);
  } catch (error) {
    console.error("[DB] Falha crítica ao conectar:", error);
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
  const db = await requireDb("users");
  await db.insert(users).values(user).onConflictDoUpdate({
    target: users.openId,
    set: { name: user.name, email: user.email, lastSignedIn: new Date() },
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await requireDb("users");
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

export async function getConsultores() {
  const db = await requireDb("consultores");
  return await db.select().from(consultores);
}

export async function getClientes() {
  const db = await requireDb("clientes");
  return await db.select().from(clientes);
}

export async function getGoogleSheetsConfig() {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(googleSheetsConfig).limit(1);
    return result[0] ?? null;
  } catch (error) {
    console.error("[DB] Erro ao buscar configuração do Sheets:", error);
    return null;
  }
}

export async function saveGoogleSheetsConfig(
  sheetsUrl: string, 
  configuredBy: number, 
  fileName?: string // Novo parâmetro opcional
): Promise<boolean> {
  const db = await requireDb("sheetsConfig");
  try {
    const existing = await getGoogleSheetsConfig();
    if (existing) {
      await db.update(googleSheetsConfig)
        .set({ sheetsUrl, fileName: fileName ?? existing.fileName, updatedAt: new Date() })
        .where(eq(googleSheetsConfig.id, existing.id));
    } else {
      await db.insert(googleSheetsConfig).values({ sheetsUrl, configuredBy, fileName });
    }
    return true;
  } catch (error: any) {
    console.error("[DB] Erro ao salvar configuração:", error);
    throw new Error(error.message);
  }
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
  const db = await requireDb("syncHistory");
  await db.insert(syncHistory).values(params);
  return true;
}

export async function insertSyncLog(log: InsertSyncLog): Promise<void> {
  const db = await requireDb("syncLogs");
  await db.insert(syncLogs).values(log);
}