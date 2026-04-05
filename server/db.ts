/**
 * server/db.ts
 *
 * Camada de acesso ao banco de dados.
 * Instância lazy do Drizzle + queries organizadas por domínio.
 *
 * Regras:
 *  - Nunca expor a instância `db` diretamente — sempre via getDb().
 *  - Cada query lança exceção descritiva em vez de retornar null/undefined.
 *  - Logs prefixados com [DB:<domínio>] para rastreabilidade.
 */

import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
import { ENV } from "./_core/env";

// =============================================================================
// INSTÂNCIA DO BANCO
// =============================================================================

let _db: ReturnType<typeof drizzle> | null = null;

/** Retorna a instância do Drizzle. Cria na primeira chamada (lazy). */
export async function getDb() {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    console.warn("[DB] DATABASE_URL não definida — banco indisponível.");
    return null;
  }

  try {
    _db = drizzle(process.env.DATABASE_URL);
  } catch (error) {
    console.warn("[DB] Falha ao conectar:", error);
    _db = null;
  }

  return _db;
}

/** Helper interno: obtém o banco ou lança erro padronizado. */
async function requireDb(context: string) {
  const db = await getDb();
  if (!db) throw new Error(`[DB:${context}] Banco de dados indisponível.`);
  return db;
}

// =============================================================================
// USUÁRIOS
// =============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("[DB:users] openId é obrigatório.");

  const db = await getDb();
  if (!db) {
    console.warn("[DB:users] upsertUser ignorado — banco indisponível.");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    values[field] = value ?? null;
    updateSet[field] = value ?? null;
  }

  const lastSignedIn = user.lastSignedIn ?? new Date();
  values.lastSignedIn = lastSignedIn;
  updateSet.lastSignedIn = lastSignedIn;

  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : undefined);
  if (role) {
    values.role = role;
    updateSet.role = role;
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0] ?? undefined;
}

// =============================================================================
// PRODUTOS
// =============================================================================

export async function upsertProduto(produto: InsertProduto): Promise<void> {
  const db = await requireDb("produtos");

  await db
    .insert(produtos)
    .values(produto)
    .onDuplicateKeyUpdate({ set: { descricao: produto.descricao } });
}

// =============================================================================
// PEDIDOS DE RASTREIO
// =============================================================================

export async function getPedidosByStatus(status: string) {
  const db = await requireDb("pedidos");
  return db
    .select()
    .from(pedidosRastreio)
    .where(eq(pedidosRastreio.orderStatus, status as any));
}

/**
 * Retorna todos os pedidos com notificação pendente (status começa com PENDING_).
 */
export async function getPedidosPendentes() {
  const db = await requireDb("pedidos");
  return db
    .select()
    .from(pedidosRastreio)
    .where(like(pedidosRastreio.notificationSentStatus, "PENDING_%"));
}

export async function insertPedidoRastreio(pedido: InsertPedidoRastreio) {
  const db = await requireDb("pedidos");
  return db.insert(pedidosRastreio).values(pedido);
}

export async function updatePedidoRastreio(
  id: number,
  updates: Partial<InsertPedidoRastreio>
): Promise<void> {
  const db = await requireDb("pedidos");
  await db
    .update(pedidosRastreio)
    .set(updates)
    .where(eq(pedidosRastreio.id, id));
}

// =============================================================================
// CONSULTORES & CLIENTES
// =============================================================================

export async function getConsultores() {
  const db = await requireDb("consultores");
  return db.select().from(consultores);
}

export async function getClientes() {
  const db = await requireDb("clientes");
  return db.select().from(clientes);
}

// =============================================================================
// GOOGLE SHEETS CONFIG
// =============================================================================

export async function getGoogleSheetsConfig() {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(googleSheetsConfig).limit(1);
  return result[0] ?? null;
}

export async function saveGoogleSheetsConfig(
  sheetsUrl: string,
  configuredBy: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const existing = await getGoogleSheetsConfig();

  if (existing) {
    await db
      .update(googleSheetsConfig)
      .set({ sheetsUrl, updatedAt: new Date() })
      .where(eq(googleSheetsConfig.id, existing.id));
  } else {
    await db.insert(googleSheetsConfig).values({ sheetsUrl, configuredBy });
  }

  return true;
}

// =============================================================================
// HISTÓRICO DE SINCRONIZAÇÕES
// =============================================================================

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

// =============================================================================
// SYNC LOGS (upload de arquivo)
// =============================================================================

export async function insertSyncLog(log: InsertSyncLog): Promise<void> {
  const db = await requireDb("syncLogs");
  await db.insert(syncLogs).values(log);
}
