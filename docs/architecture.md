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
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │          SISTEMA MULTI-AGENTE                       │ │
│  │                                                     │ │
│  │  AgentRegistry (Orquestrador)                       │ │
│  │  EventBus (Comunicação Pub/Sub Tipada)              │ │
│  │                                                     │ │
│  │  📊 DataSyncAgent   → sync:completed/failed         │ │
│  │  🚚 LogisticsAgent  → conflict_detected/changed     │ │
│  │  📧 NotificationAgent ← escuta todos os eventos    │ │
│  │  🧠 AnalyticsAgent  → anomaly_detected             │ │
│  │  ✅ TaskAutomationAgent → task:auto_created         │ │
│  └─────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────┘
                         │  Drizzle ORM
┌────────────────────────▼─────────────────────────────────┐
│                      PostgreSQL                          │
│                                                          │
│  users │ consultores │ clientes │ produtos               │
│  pedidos_rastreio │ sync_logs │ sync_history             │
│  google_sheets_config │ tasks │ task_templates           │
│  avarias │ demandas                                      │
└──────────────────────────────────────────────────────────┘
```

## Sistema Multi-Agente

### Componentes do Framework (`server/agents/_framework/`)

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| **BaseAgent** | `base-agent.ts` | Classe abstrata com ciclo de vida, circuit breaker, métricas |
| **EventBus** | `event-bus.ts` | Pub/Sub tipado, wildcard, dead letter queue, replay |
| **AgentRegistry** | `agent-registry.ts` | Registro, dependency resolution, health monitoring |
| **Types** | `types.ts` | Contratos e interfaces (AgentEventMap, AgentContext, etc.) |

### Agentes Especializados (`server/agents/`)

| Agente | Domínio | Escuta | Emite |
|---|---|---|---|
| `DataSyncAgent` | Sincronização | — | `sync:completed`, `sync:failed` |
| `LogisticsAgent` | Logística | `sync:completed` | `logistics:conflict_detected`, `logistics:status_changed` |
| `NotificationAgent` | Comunicação | Todos os eventos | `notification:sent` |
| `AnalyticsAgent` | Inteligência | `sync:completed`, `logistics:automation_completed` | `analytics:anomaly_detected`, `analytics:kpis_computed` |
| `TaskAutomationAgent` | Operacional | `analytics:anomaly_detected` | `task:auto_created`, `task:escalation_needed` |

### Fluxo de Eventos

```
DataSync ──sync:completed──► Logistics ──conflict_detected──► Notification
                           └──► Analytics ──anomaly_detected──► TaskAutomation
                                                              └──► Notification
```

### Endpoints da API

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/api/agents/:name/execute` | Executa agente com parâmetros |
| `GET` | `/api/agents/health` | Status de saúde de todos os agentes |
| `GET` | `/api/agents/list` | Lista agentes com métricas |
| `GET` | `/api/agents/events` | Histórico e métricas do EventBus |

## Fluxo de Sincronização

```
Google Sheets URL
      │
      ▼
 DataSyncAgent.execute()
  ├── Lê dados da planilha (via sync.engine.ts)
  ├── Para cada linha:
  │    ├── upsertProduto (SKU)
  │    ├── Resolve OrderStatus (Faturado/Previsto/Chegou)
  │    ├── Se novo → insere com PENDING_<FASE>
  │    └── Se existente e mudou de fase → atualiza para PENDING_<FASE>
  ├── Emite sync:completed → EventBus
  │    ├── LogisticsAgent reage: roda cross-reference
  │    └── AnalyticsAgent reage: recalcula KPIs
  └── Retorna AgentResult { success, data, logs }
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
| Executar agentes | ✅ | ❌ |
| Ver health dos agentes | ✅ | ❌ |
