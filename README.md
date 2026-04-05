# ESTOQUE — T Store Curitiba

Plataforma inteligente de rastreamento de pedidos com sincronização via Google Sheets, motor de notificações por e-mail e dashboard administrativo.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Shadcn/ui |
| Roteamento | Wouter |
| API Client | tRPC |
| Backend | Node.js + Express + tRPC |
| ORM | Drizzle ORM |
| Banco de Dados | MySQL 8.0 |
| Auth | JWT |
| E-mail | Gmail OAuth2 |
| Infra | Docker + Docker Compose |

## Estrutura do Projeto

```
tstore-estoque/
├── client/                        # Frontend React
│   └── src/
│       ├── pages/                 # Páginas (rotas)
│       │   ├── Home.tsx
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── UploadExcel.tsx
│       │   └── recebimento/
│       │       ├── Produtos.tsx
│       │       ├── KPIs.tsx
│       │       └── Config.tsx
│       ├── components/
│       │   ├── layout/            # Componentes estruturais
│       │   │   ├── MainLayout.tsx
│       │   │   └── Sidebar.tsx
│       │   └── ui/                # Shadcn/ui components
│       ├── hooks/                 # Custom hooks
│       │   └── useAuth.ts
│       ├── lib/                   # Utilitários e configs
│       │   ├── trpc.ts
│       │   └── utils.ts
│       ├── types/                 # Tipos compartilhados do cliente
│       │   └── index.ts
│       ├── constants/             # Constantes da aplicação
│       │   └── index.ts
│       └── App.tsx
│
├── server/                        # Backend Node.js
│   ├── routers/                   # tRPC routers por domínio
│   │   ├── auth.router.ts
│   │   ├── admin.router.ts
│   │   ├── notification.router.ts
│   │   └── index.ts               # AppRouter aggregator
│   ├── services/                  # Serviços externos
│   │   └── gmail.service.ts
│   ├── engines/                   # Lógica de negócio core
│   │   ├── sync.engine.ts
│   │   └── notification.engine.ts
│   ├── db.ts                      # Instância e queries do banco
│   └── _core/                     # Infraestrutura tRPC/auth (gerado)
│
├── drizzle/                       # Schema e migrations
│   ├── schema.ts
│   └── migrations/
│       └── 0001_volatile_wolfpack.sql
│
├── scripts/                       # Scripts utilitários Python
│   ├── migrate_data.py
│   ├── sync_engine.py
│   ├── notification_engine.py
│   └── validate_logic.py
│
├── docs/                          # Documentação técnica
│   ├── architecture.md
│   └── data-mapping.md
│
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
└── package.json
```

## Instalação Local

### Pré-requisitos
- Node.js 22+
- pnpm
- Docker & Docker Compose

### 1. Instalar dependências
```bash
pnpm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### 3. Subir o banco de dados
```bash
docker-compose up -d db
```

### 4. Executar migrations
```bash
pnpm db:push
```

### 5. Iniciar em desenvolvimento
```bash
pnpm dev
```

Acesse: `http://localhost:3000`

## Deploy com Docker

```bash
docker-compose up -d
```

## Credenciais de Teste

| Role | Email | Senha |
|------|-------|-------|
| Admin | admin@tstore.com | admin123 |
| Consultor | consultor@tstore.com | consultor123 |

## Lógica de Notificações — 3 Fases

| Fase | Condição | Status |
|------|----------|--------|
| Faturado | Sem previsão e sem data de entrega | `PENDING_FATURADO` |
| Previsto | Com previsão, sem data de entrega | `PENDING_PREVISTO` |
| Chegou | Data de entrega preenchida | `PENDING_CHEGOU` |

## Variáveis de Ambiente

Veja o arquivo `.env.example` para a lista completa de variáveis necessárias.
