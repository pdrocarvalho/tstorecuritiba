import { relations } from "drizzle-orm";
import {
  integer,
  serial,
  pgEnum,
  pgTable,
  index,
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
  qtdePorCaixa: integer("qtde_por_caixa").default(1),
  previsaoEntrega: timestamp("previsao_entrega"),
  dataEntrega: timestamp("data_entrega"),
  orderStatus: orderStatusEnum("order_status").notNull(),
  notificationSentStatus: varchar("notification_sent_status", { length: 50 }).default("PENDING_FATURADO").notNull(),
  consultorId: integer("consultor_id").references(() => consultores.id, { onDelete: "set null" }),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "set null" }),

  // --- AS NOSSAS NOVAS COLUNAS PARA OS KPIs ---
  remetente: varchar("remetente", { length: 255 }),
  notaFiscal: varchar("nota_fiscal", { length: 255 }),
  mundo: varchar("mundo", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orderStatusIdx: index("pedidos_order_status_idx").on(table.orderStatus),
  notificationStatusIdx: index("pedidos_notification_status_idx").on(table.notificationSentStatus),
  produtoSkuIdx: index("pedidos_produto_sku_idx").on(table.produtoSku),
  consultorIdIdx: index("pedidos_consultor_id_idx").on(table.consultorId),
  clienteIdIdx: index("pedidos_cliente_id_idx").on(table.clienteId),
}));

export type PedidoRastreio = typeof pedidosRastreio.$inferSelect;
export type InsertPedidoRastreio = typeof pedidosRastreio.$inferInsert;

export const googleSheetsConfig = pgTable("google_sheets_config", {
  id: serial("id").primaryKey(),
  sheetsUrl: varchar("sheets_url", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 255 }), // <-- NOVA COLUNA
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
export type OrderStatus = "Faturado" | "Previsto" | "Chegou";
export type NotificationStatus =
  | "PENDING_FATURADO"
  | "PENDING_PREVISTO"
  | "PENDING_CHEGOU"
  | "SENT_FATURADO"
  | "SENT_PREVISTO"
  | "SENT_CHEGOU";

export const pedidosRastreioRelations = relations(pedidosRastreio, ({ one }) => ({
  consultor: one(consultores, {
    fields: [pedidosRastreio.consultorId],
    references: [consultores.id],
  }),
  cliente: one(clientes, {
    fields: [pedidosRastreio.clienteId],
    references: [clientes.id],
  }),
}));

export const consultoresRelations = relations(consultores, ({ many }) => ({
  pedidos: many(pedidosRastreio),
}));

export const clientesRelations = relations(clientes, ({ many }) => ({
  pedidos: many(pedidosRastreio),
}));