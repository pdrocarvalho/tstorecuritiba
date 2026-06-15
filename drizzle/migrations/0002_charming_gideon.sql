DO $$ BEGIN
 CREATE TYPE "notification_status" AS ENUM('PENDING_FATURADO', 'PENDING_PREVISTO', 'PENDING_CHEGOU', 'SENT_FATURADO', 'SENT_PREVISTO', 'SENT_CHEGOU');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "pedidos_rastreio" ALTER COLUMN "notification_sent_status" DROP DEFAULT;
ALTER TABLE "pedidos_rastreio" ALTER COLUMN "notification_sent_status" SET DATA TYPE notification_status USING "notification_sent_status"::notification_status;
ALTER TABLE "pedidos_rastreio" ALTER COLUMN "notification_sent_status" SET DEFAULT 'PENDING_FATURADO';