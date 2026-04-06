import {
  integer,
  serial,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const orderStatusEnum = pgEnum("order_status", ["Faturado", "Previsto", "Chegou"]);
export const syncStatusEnum = pgEnum("sync_status", ["sucesso", "erro"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const consultores = pgTable("consultores", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Consultor = typeof consultores.$inferSelect;
export type InsertConsultor = typeof consultores.$inferInsert;

export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

export const produtos = pgTable("produtos", {
  sku: varchar("sku", { length: 255 }).primaryKey(),
  descricao: text("descricao").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Produto = typeof produtos.$inferSelect;
export type InsertProduto = typeof produtos.$inferInsert;

export const pedidosRastreio = pgTable("pedidos_rastreio", {
  id: serial("id").primaryKey(),
  produtoSku: varchar("produto_sku", { length: 255 }).notNull(),
  quantidade: integer("quantidade").notNull(),
  previsaoEntrega: timestamp("previsao_entrega"),
  dataEntrega: timestamp("data_entrega"),
  orderStatus: orderStatusEnum("order_status").notNull(),
  notificationSentStatus: varchar("notification_sent_status", { length: 50 }).default("PENDING_FATURADO").notNull(),
  consultorId: integer("consultor_id"),
  clienteId: integer("cliente_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PedidoRastreio = typeof pedidosRastreio.$inferSelect;
export type InsertPedidoRastreio = typeof pedidosRastreio.$inferInsert;

export const googleSheetsConfig = pgTable("google_sheets_config", {
  id: serial("id").primaryKey(),
  sheetsUrl: varchar("sheets_url", { length: 500 }).notNull(),
  configuredBy: integer("configured_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GoogleSheetsConfig = typeof googleSheetsConfig.$inferSelect;
export type InsertGoogleSheetsConfig = typeof googleSheetsConfig.$inferInsert;

export const syncHistory = pgTable("sync_history", {
  id: serial("id").primaryKey(),
  sheetsUrl: varchar("sheets_url", { length: 500 }).notNull(),
  syncedBy: integer("synced_by").notNull(),
  novosPedidos: integer("novos_pedidos").default(0).notNull(),
  novasPrevisoes: integer("novas_previsoes").default(0).notNull(),
  chegadas: integer("chegadas").default(0).notNull(),
  status: syncStatusEnum("status").notNull(),
  mensagemErro: text("mensagem_erro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SyncHistory = typeof syncHistory.$inferSelect;
export type InsertSyncHistory = typeof syncHistory.$inferInsert;

export const syncLogs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  novosPedidos: integer("novos_pedidos").default(0).notNull(),
  novasPrevisoes: integer("novas_previsoes").default(0).notNull(),
  chegadas: integer("chegadas").default(0).notNull(),
  status: syncStatusEnum("status").notNull(),
  mensagemErro: text("mensagem_erro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = typeof syncLogs.$inferInsert;