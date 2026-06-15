CREATE INDEX IF NOT EXISTS "pedidos_order_status_idx" ON "pedidos_rastreio" ("order_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_notification_status_idx" ON "pedidos_rastreio" ("notification_sent_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_produto_sku_idx" ON "pedidos_rastreio" ("produto_sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_consultor_id_idx" ON "pedidos_rastreio" ("consultor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_cliente_id_idx" ON "pedidos_rastreio" ("cliente_id");