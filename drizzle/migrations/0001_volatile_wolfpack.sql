CREATE TABLE `clientes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultores_id` PRIMARY KEY(`id`),
	CONSTRAINT `consultores_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `pedidos_rastreio` (
	`id` int AUTO_INCREMENT NOT NULL,
	`produto_sku` varchar(255) NOT NULL,
	`quantidade` int NOT NULL,
	`previsao_entrega` timestamp,
	`data_entrega` timestamp,
	`order_status` enum('Faturado','Previsto','Chegou') NOT NULL,
	`notification_sent_status` varchar(50) NOT NULL DEFAULT 'PENDING_FATURADO',
	`consultor_id` int,
	`cliente_id` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pedidos_rastreio_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `produtos` (
	`sku` varchar(255) NOT NULL,
	`descricao` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `produtos_sku` PRIMARY KEY(`sku`)
);
--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`novos_pedidos` int NOT NULL DEFAULT 0,
	`novas_previsoes` int NOT NULL DEFAULT 0,
	`chegadas` int NOT NULL DEFAULT 0,
	`status` enum('sucesso','erro') NOT NULL,
	`mensagem_erro` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_logs_id` PRIMARY KEY(`id`)
);
