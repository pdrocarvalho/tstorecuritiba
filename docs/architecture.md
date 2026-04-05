# Arquitetura — ESTOQUE T Store Curitiba

## Visão Geral

```
┌──────────────────────────────────────────────────────────┐
│                        FRONTEND                          │
│              React + TypeScript + Tailwind               │
│                                                          │
│  Home  │  Dashboard  │  Recebimento (Produtos/KPIs/Config)│
└────────────────────────┬─────────────────────────────────┘
                         │  tRPC (type-safe end-to-end)
┌────────────────────────▼─────────────────────────────────┐
│                        BACKEND                           │
│               Node.js + Express + tRPC                   │
│                                                          │
│  auth.router  │  admin.router  │  notification.router    │
│                                                          │
│         engines/               services/                 │
│    sync.engine.ts         gmail.service.ts               │
│    notification.engine.ts                                │
└────────────────────────┬─────────────────────────────────┘
                         │  Drizzle ORM
┌────────────────────────▼─────────────────────────────────┐
│                      MySQL 8.0                           │
│                                                          │
│  users │ consultores │ clientes │ produtos               │
│  pedidos_rastreio │ sync_logs │ sync_history             │
│  google_sheets_config                                    │
└──────────────────────────────────────────────────────────┘
```

## Fluxo de Sincronização

```
Google Sheets URL
      │
      ▼
 sync.engine.ts
  ├── Lê dados da planilha
  ├── Para cada linha:
  │    ├── upsertProduto (SKU)
  │    ├── Resolve OrderStatus (Faturado/Previsto/Chegou)
  │    ├── Se novo → insere com PENDING_<FASE>
  │    └── Se existente e mudou de fase → atualiza para PENDING_<FASE>
  └── Retorna SyncResult { novosPedidos, novasPrevisoes, chegadas }
```

## Fluxo de Notificações

```
Admin clica "Enviar Notificações"
      │
      ▼
notification.router → sendPending
      │
      ├── getPendingNotifications() → pedidos com PENDING_*
      ├── groupNotificationsByConsultorAndClient()
      │    └── Agrupa por (consultorId, clienteId, orderStatus)
      ├── buildEmailHtml() → HTML personalizado por fase
      ├── sendBulkEmails() → Gmail API
      └── markNotificationsAsSent() → PENDING_* → SENT_*
```

## Regra de Ouro — Transições de Fase

| De | Para | Trigger | Novo Status |
|----|------|---------|-------------|
| Faturado | Previsto | previsaoEntrega preenchida | PENDING_PREVISTO |
| Previsto | Chegou | dataEntrega preenchida | PENDING_CHEGOU |

Sempre que o status muda para `PENDING_*`, o motor de notificações
enviará um e-mail na próxima execução.

## RBAC

| Ação | Admin | Consultor |
|------|-------|-----------|
| Ver pedidos | ✅ | ✅ |
| Ver KPIs | ✅ | ✅ |
| Configurar Sheets | ✅ | ❌ |
| Sincronizar dados | ✅ | ❌ |
| Enviar notificações | ✅ | ❌ |
