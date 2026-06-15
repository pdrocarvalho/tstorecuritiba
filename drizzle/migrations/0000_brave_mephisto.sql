DO $$ BEGIN
 CREATE TYPE "order_status" AS ENUM('Faturado', 'Previsto', 'Chegou');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "role" AS ENUM('user', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "sync_status" AS ENUM('sucesso', 'erro');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consultores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "consultores_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_sheets_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"sheets_url" varchar(500) NOT NULL,
	"file_name" varchar(255),
	"configured_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedidos_rastreio" (
	"id" serial PRIMARY KEY NOT NULL,
	"produto_sku" varchar(255) NOT NULL,
	"quantidade" integer NOT NULL,
	"qtde_por_caixa" integer DEFAULT 1,
	"previsao_entrega" timestamp,
	"data_entrega" timestamp,
	"order_status" "order_status" NOT NULL,
	"notification_sent_status" varchar(50) DEFAULT 'PENDING_FATURADO' NOT NULL,
	"consultor_id" integer,
	"cliente_id" integer,
	"remetente" varchar(255),
	"nota_fiscal" varchar(255),
	"mundo" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "produtos" (
	"sku" varchar(255) PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"sheets_url" varchar(500) NOT NULL,
	"synced_by" integer NOT NULL,
	"novos_pedidos" integer DEFAULT 0 NOT NULL,
	"novas_previsoes" integer DEFAULT 0 NOT NULL,
	"chegadas" integer DEFAULT 0 NOT NULL,
	"status" "sync_status" NOT NULL,
	"mensagem_erro" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"novos_pedidos" integer DEFAULT 0 NOT NULL,
	"novas_previsoes" integer DEFAULT 0 NOT NULL,
	"chegadas" integer DEFAULT 0 NOT NULL,
	"status" "sync_status" NOT NULL,
	"mensagem_erro" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"open_id" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"login_method" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_signed_in" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos_rastreio" ADD CONSTRAINT "pedidos_rastreio_consultor_id_consultores_id_fk" FOREIGN KEY ("consultor_id") REFERENCES "consultores"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos_rastreio" ADD CONSTRAINT "pedidos_rastreio_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
