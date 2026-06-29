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
  boolean,
  date,
  jsonb,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const orderStatusEnum = pgEnum("order_status", ["Faturado", "Previsto", "Chegou"]);
export const syncStatusEnum = pgEnum("sync_status", ["sucesso", "erro"]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "PENDING_FATURADO",
  "PENDING_PREVISTO",
  "PENDING_CHEGOU",
  "SENT_FATURADO",
  "SENT_PREVISTO",
  "SENT_CHEGOU"
]);

// ─── SISTEMA DE TAREFAS ─────────────────────────────────────────────────────
export const taskCategoryEnum = pgEnum("task_category", [
  "abertura", "fechamento", "estoque", "geral"
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "alta", "media", "baixa"
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pendente", "concluida", "nao_aplicavel"
]);

export const taskTargetProfileEnum = pgEnum("task_target_profile", [
  "consultor", "adm", "todos"
]);

// Templates de tarefas recorrentes (configurados pelo Admin)
export const taskTemplates = pgTable("task_templates", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  categoria: taskCategoryEnum("categoria").notNull(),
  perfilAlvo: taskTargetProfileEnum("perfil_alvo").notNull().default("consultor"),
  diasSemana: text("dias_semana"), // JSON string: "[1,3,5]" = seg/qua/sex. NULL = todos os dias
  condicional: boolean("condicional").default(false).notNull(),
  condicaoTexto: text("condicao_texto"),
  ordem: integer("ordem").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type InsertTaskTemplate = typeof taskTemplates.$inferInsert;

// Instâncias concretas de tarefas (geradas diariamente ou criadas como avulsas)
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => taskTemplates.id, { onDelete: "set null" }),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  categoria: taskCategoryEnum("categoria").notNull(),
  prioridade: taskPriorityEnum("prioridade").default("media"),
  dataReferencia: date("data_referencia").notNull(),
  prazo: timestamp("prazo"),
  atribuidoPara: integer("atribuido_para").references(() => users.id, { onDelete: "set null" }),
  status: taskStatusEnum("status").default("pendente").notNull(),
  comentario: text("comentario"),
  concluidoEm: timestamp("concluido_em"),
  concluidoPor: integer("concluido_por").references(() => users.id, { onDelete: "set null" }),
  condicional: boolean("condicional").default(false).notNull(),
  condicaoTexto: text("condicao_texto"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  dataReferenciaIdx: index("tasks_data_referencia_idx").on(table.dataReferencia),
  atribuidoParaIdx: index("tasks_atribuido_para_idx").on(table.atribuidoPara),
  statusIdx: index("tasks_status_idx").on(table.status),
  categoriaIdx: index("tasks_categoria_idx").on(table.categoria),
}));

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

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
  sheetId: varchar("sheet_id", { length: 255 }).unique(),
  produtoSku: varchar("produto_ref", { length: 255 }).references(() => produtos.sku).notNull(),
  quantidade: integer("quantidade").notNull(),
  qtdePorCaixa: integer("qtde_por_caixa").default(1),
  previsaoEntrega: date("previsao_entrega", { mode: "date" }),
  dataEntrega: date("data_entrega", { mode: "date" }),
  orderStatus: orderStatusEnum("order_status").notNull(),
  notificationSentStatus: notificationStatusEnum("notification_sent_status").default("PENDING_FATURADO").notNull(),
  consultorId: integer("consultor_id").references(() => consultores.id, { onDelete: "set null" }),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "set null" }),

  // --- AS NOSSAS NOVAS COLUNAS PARA OS KPIs ---
  remetente: varchar("remetente", { length: 255 }),
  notaFiscal: varchar("nota_fiscal", { length: 255 }),
  mundo: varchar("mundo", { length: 255 }),
  transportadora: varchar("transportadora", { length: 255 }),
  divergencia: varchar("divergencia", { length: 255 }),
  mes: varchar("mes", { length: 50 }),
  dataEmbarque: date("data_embarque", { mode: "date" }),
  volumesCaixas: integer("volumes_caixas").default(0),

  valorDesconto: varchar("valor_desconto", { length: 255 }),
  descontoPromocional: varchar("desconto_promocional", { length: 255 }),
  acrescimoAdicional: varchar("acrescimo_adicional", { length: 255 }),
  precoItem: varchar("preco_item", { length: 255 }),
  subTotal: varchar("sub_total", { length: 255 }),

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
  configuredBy: integer("configured_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GoogleSheetsConfig = typeof googleSheetsConfig.$inferSelect;
export type InsertGoogleSheetsConfig = typeof googleSheetsConfig.$inferInsert;

export const syncHistory = pgTable("sync_history", {
  id: serial("id").primaryKey(),
  sheetsUrl: varchar("sheets_url", { length: 500 }).notNull(),
  syncedBy: integer("synced_by").references(() => users.id).notNull(),
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

export const avarias = pgTable("avarias", {
  id: serial("id").primaryKey(),
  sheetId: varchar("sheet_id", { length: 255 }).unique(),
  produtoSku: varchar("produto_sku", { length: 255 }).references(() => produtos.sku, { onDelete: "set null" }),
  codAvaria: varchar("cod_avaria", { length: 255 }),
  fabrica: varchar("fabrica", { length: 255 }),
  descricao: text("descricao"),
  quantidade: integer("quantidade").default(1).notNull(),
  tratativa: text("tratativa"),
  status: varchar("status", { length: 255 }),
  okStatus: varchar("ok_status", { length: 255 }),
  dataDaColeta: varchar("data_da_coleta", { length: 255 }),
  notaFiscalDeSaida: varchar("nota_fiscal_de_saida", { length: 255 }),
  notaFiscalDeReposicao: varchar("nota_fiscal_de_reposicao", { length: 255 }),
  foiLancadoNoSistema: varchar("foi_lancado_no_sistema", { length: 255 }),
  constaFisicamente: varchar("consta_fisicamente", { length: 255 }),
  motivo: text("motivo"),
  dataDeEntrada: varchar("data_de_entrada", { length: 255 }),
  notaFiscalDeEntrada: varchar("nota_fiscal_de_entrada", { length: 255 }),
  cupomFiscal: varchar("cupom_fiscal", { length: 255 }),
  observacoes: text("observacoes"),
  responsavel: varchar("responsavel", { length: 255 }),
  dataMudancaTratativa: timestamp("data_mudanca_tratativa"), // Campo rastreado pelo DataSyncAgent
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  produtoSkuIdx: index("avarias_produto_sku_idx").on(table.produtoSku),
  statusIdx: index("avarias_status_idx").on(table.status),
}));

export type Avaria = typeof avarias.$inferSelect;
export type InsertAvaria = typeof avarias.$inferInsert;

export const demandas = pgTable("demandas", {
  id: serial("id").primaryKey(),
  sheetId: varchar("sheet_id", { length: 255 }).unique(),
  data: varchar("data", { length: 255 }),
  consultorId: integer("consultor_id").references(() => consultores.id, { onDelete: "set null" }),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "set null" }),
  contato: varchar("contato", { length: 255 }),
  produtoSku: varchar("produto_sku", { length: 255 }).references(() => produtos.sku, { onDelete: "set null" }),
  status: varchar("status", { length: 255 }),
  quantidade: integer("quantidade").default(1).notNull(),
  threadId: varchar("thread_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  produtoSkuIdx: index("demandas_produto_sku_idx").on(table.produtoSku),
  consultorIdIdx: index("demandas_consultor_id_idx").on(table.consultorId),
  clienteIdIdx: index("demandas_cliente_id_idx").on(table.clienteId),
  statusIdx: index("demandas_status_idx").on(table.status),
}));

export type Demanda = typeof demandas.$inferSelect;
export type InsertDemanda = typeof demandas.$inferInsert;

export const usersRelations = relations(users, ({ many }) => ({
  tasksAtribuidas: many(tasks, { relationName: "atribuidoPara" }),
  tasksConcluidas: many(tasks, { relationName: "concluidoPor" }),
  googleSheetsConfigs: many(googleSheetsConfig),
  syncHistories: many(syncHistory),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  template: one(taskTemplates, {
    fields: [tasks.templateId],
    references: [taskTemplates.id],
  }),
  atribuidoPara: one(users, {
    fields: [tasks.atribuidoPara],
    references: [users.id],
    relationName: "atribuidoPara",
  }),
  concluidoPor: one(users, {
    fields: [tasks.concluidoPor],
    references: [users.id],
    relationName: "concluidoPor",
  }),
}));

export const produtosRelations = relations(produtos, ({ many }) => ({
  pedidos: many(pedidosRastreio),
  avarias: many(avarias),
  demandas: many(demandas),
}));

export const pedidosRastreioRelations = relations(pedidosRastreio, ({ one }) => ({
  consultor: one(consultores, {
    fields: [pedidosRastreio.consultorId],
    references: [consultores.id],
  }),
  cliente: one(clientes, {
    fields: [pedidosRastreio.clienteId],
    references: [clientes.id],
  }),
  produto: one(produtos, {
    fields: [pedidosRastreio.produtoSku],
    references: [produtos.sku],
  }),
}));

export const consultoresRelations = relations(consultores, ({ many }) => ({
  pedidos: many(pedidosRastreio),
  demandas: many(demandas),
}));

export const clientesRelations = relations(clientes, ({ many }) => ({
  pedidos: many(pedidosRastreio),
  demandas: many(demandas),
}));

export const avariasRelations = relations(avarias, ({ one }) => ({
  produto: one(produtos, {
    fields: [avarias.produtoSku],
    references: [produtos.sku],
  }),
}));

export const demandasRelations = relations(demandas, ({ one }) => ({
  consultor: one(consultores, {
    fields: [demandas.consultorId],
    references: [consultores.id],
  }),
  cliente: one(clientes, {
    fields: [demandas.clienteId],
    references: [clientes.id],
  }),
  produto: one(produtos, {
    fields: [demandas.produtoSku],
    references: [produtos.sku],
  }),
}));

export const googleSheetsConfigRelations = relations(googleSheetsConfig, ({ one }) => ({
  configuredBy: one(users, {
    fields: [googleSheetsConfig.configuredBy],
    references: [users.id],
  }),
}));

export const syncHistoryRelations = relations(syncHistory, ({ one }) => ({
  syncedBy: one(users, {
    fields: [syncHistory.syncedBy],
    references: [users.id],
  }),
}));