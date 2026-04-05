/**
 * drizzle/schema.ts
 *
 * Schema central do banco de dados (Drizzle ORM + MySQL).
 * Cada tabela é exportada individualmente junto com seus tipos inferidos.
 *
 * Convenção de nomenclatura:
 *  - Tabelas: snake_case no banco, camelCase no código
 *  - Colunas: camelCase (Drizzle mapeia automaticamente)
 */

import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// =============================================================================
// USUÁRIOS
// =============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** ID externo do provedor OAuth (ex: Manus openId). Único por usuário. */
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// =============================================================================
// CONSULTORES
// =============================================================================

export const consultores = mysqlTable("consultores", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Consultor = typeof consultores.$inferSelect;
export type InsertConsultor = typeof consultores.$inferInsert;

// =============================================================================
// CLIENTES
// =============================================================================

export const clientes = mysqlTable("clientes", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

// =============================================================================
// PRODUTOS
// =============================================================================

export const produtos = mysqlTable("produtos", {
  /** SKU é a chave primária natural do produto. */
  sku: varchar("sku", { length: 255 }).primaryKey(),
  descricao: text("descricao").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Produto = typeof produtos.$inferSelect;
export type InsertProduto = typeof produtos.$inferInsert;

// =============================================================================
// PEDIDOS DE RASTREIO
// =============================================================================

/**
 * Status do ciclo de vida do pedido.
 * A "Regra de Ouro": muda para PENDING_* sempre que há transição de fase.
 */
export type OrderStatus = "Faturado" | "Previsto" | "Chegou";
export type NotificationStatus =
  | "PENDING_FATURADO"
  | "PENDING_PREVISTO"
  | "PENDING_CHEGOU"
  | "SENT_FATURADO"
  | "SENT_PREVISTO"
  | "SENT_CHEGOU";

export const pedidosRastreio = mysqlTable("pedidos_rastreio", {
  id: int("id").autoincrement().primaryKey(),
  produtoSku: varchar("produto_sku", { length: 255 }).notNull(),
  quantidade: int("quantidade").notNull(),
  previsaoEntrega: timestamp("previsao_entrega"),
  dataEntrega: timestamp("data_entrega"),
  orderStatus: mysqlEnum("order_status", [
    "Faturado",
    "Previsto",
    "Chegou",
  ]).notNull(),
  notificationSentStatus: varchar("notification_sent_status", {
    length: 50,
  })
    .default("PENDING_FATURADO")
    .notNull(),
  consultorId: int("consultor_id"),
  clienteId: int("cliente_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PedidoRastreio = typeof pedidosRastreio.$inferSelect;
export type InsertPedidoRastreio = typeof pedidosRastreio.$inferInsert;

// =============================================================================
// CONFIGURAÇÃO DO GOOGLE SHEETS
// =============================================================================

export const googleSheetsConfig = mysqlTable("google_sheets_config", {
  id: int("id").autoincrement().primaryKey(),
  sheetsUrl: varchar("sheets_url", { length: 500 }).notNull(),
  /** FK para users.id — quem configurou. */
  configuredBy: int("configured_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type GoogleSheetsConfig = typeof googleSheetsConfig.$inferSelect;
export type InsertGoogleSheetsConfig = typeof googleSheetsConfig.$inferInsert;

// =============================================================================
// HISTÓRICO DE SINCRONIZAÇÕES
// =============================================================================

export const syncHistory = mysqlTable("sync_history", {
  id: int("id").autoincrement().primaryKey(),
  sheetsUrl: varchar("sheets_url", { length: 500 }).notNull(),
  syncedBy: int("synced_by").notNull(),
  novosPedidos: int("novos_pedidos").default(0).notNull(),
  novasPrevisoes: int("novas_previsoes").default(0).notNull(),
  chegadas: int("chegadas").default(0).notNull(),
  status: mysqlEnum("status", ["sucesso", "erro"]).notNull(),
  mensagemErro: text("mensagem_erro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SyncHistory = typeof syncHistory.$inferSelect;
export type InsertSyncHistory = typeof syncHistory.$inferInsert;

// =============================================================================
// LOGS DE SINCRONIZAÇÃO (upload de arquivo)
// =============================================================================

export const syncLogs = mysqlTable("sync_logs", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  novosPedidos: int("novos_pedidos").default(0).notNull(),
  novasPrevisoes: int("novas_previsoes").default(0).notNull(),
  chegadas: int("chegadas").default(0).notNull(),
  status: mysqlEnum("status", ["sucesso", "erro"]).notNull(),
  mensagemErro: text("mensagem_erro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = typeof syncLogs.$inferInsert;
