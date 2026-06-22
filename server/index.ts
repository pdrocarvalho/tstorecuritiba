/**
 * server/index.ts
 */
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/trpc";
import { OAuth2Client } from "google-auth-library";
import { upsertUser, getUserByOpenId, updateUserRole } from "./repositories/user.repository";
import { env } from "./_core/env";

// ─── MULTI-AGENT SYSTEM ──────────────────────────────────────────────────────
import { bootstrapAgents, getRegistry } from "./agents";

const app = express();
const PORT = env.PORT;

const DOMINIO_PERMITIDO = "tramontinastore.com";
const EMAILS_EXCECAO = ["pdrolcarvalho@gmail.com"];
const ADMIN_EMAILS = [
  "pdrolcarvalho@gmail.com",
  "francisco.honorio@tramontinastore.com"
];

// MIDDLEWARE DE SEGURANÇA (COOP/COEP) - DEVE SER O PRIMEIRO
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000"
];
if (env.FRONTEND_URL) {
  allowedOrigins.push(env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Permite deploys preview da Vercel apenas em ambiente que não seja produção estrita
    if (origin.endsWith('.vercel.app') && env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    callback(new Error('Origem não permitida pela política de CORS'));
  },
  credentials: true
}));
app.use(express.json());

import { login, me } from "./controllers/auth.controller";

/**
 * ENDPOINTS DE AUTENTICAÇÃO REST
 */
app.post("/api/auth/login", login);
app.get("/api/auth/me", me);

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  ENDPOINTS DO SISTEMA MULTI-AGENTE
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * POST /api/agents/:name/execute
 * Executa um agente específico com parâmetros opcionais.
 *
 * Exemplos:
 *   POST /api/agents/data-sync/execute     { "mode": "full" }
 *   POST /api/agents/logistics/execute     { "action": "automate" }
 *   POST /api/agents/analytics/execute     { "action": "kpis" }
 *   POST /api/agents/task-automation/execute { "action": "check_overdue" }
 *   POST /api/agents/notification/execute  {}
 */
app.post("/api/agents/:name/execute", async (req, res) => {
  try {
    const { name } = req.params;
    const params = req.body || {};
    const triggeredBy = (req.headers["x-triggered-by"] as string) || "user";

    const registry = getRegistry();
    const result = await registry.executeAgent(name, params, triggeredBy);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agents/data-sync
 * Endpoint legado — mantido para compatibilidade.
 * Delega para o novo sistema via AgentRegistry.
 */
app.post("/api/agents/data-sync", async (req, res) => {
  try {
    const registry = getRegistry();
    const result = await registry.executeAgent("data-sync", {
      avarias: process.env.SHEET_ID_AVARIAS,
      demandas: process.env.SHEET_ID_DEMANDAS,
      recebimentos: process.env.SHEET_ID_RECEBIMENTOS,
      mode: "full",
    }, "user");

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/agents/health
 * Retorna o status de saúde de todos os agentes.
 */
app.get("/api/agents/health", async (_req, res) => {
  try {
    const registry = getRegistry();
    const report = await registry.getHealthReport();
    const statusCode = report.overallHealthy ? 200 : 503;
    res.status(statusCode).json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/agents/list
 * Lista todos os agentes registrados com seus status e métricas.
 */
app.get("/api/agents/list", async (_req, res) => {
  try {
    const registry = getRegistry();
    const agents = registry.listAgents();
    const eventBusMetrics = registry.getEventBus().getMetrics();
    res.json({ agents, eventBus: eventBusMetrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/agents/events
 * Retorna o histórico de eventos do EventBus (para debugging).
 */
app.get("/api/agents/events", async (_req, res) => {
  try {
    const registry = getRegistry();
    const eventBus = registry.getEventBus();
    res.json({
      metrics: eventBus.getMetrics(),
      history: eventBus.getEventHistory().slice(-50), // Últimos 50
      deadLetters: eventBus.getDeadLetterQueue(),
      registeredEvents: eventBus.getRegisteredEvents(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health check para o Render
app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

// Integração com tRPC — com contexto de autenticação
export type AppRouter = typeof appRouter;

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// ─── INÍCIO DO SERVIDOR + BOOT DOS AGENTES ──────────────────────────────────
app.listen(PORT, async () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🔒 Domínio permitido: @${DOMINIO_PERMITIDO}`);
  console.log(`✉️  E-mails de exceção: ${EMAILS_EXCECAO.join(", ")}`);

  // Boot do sistema multi-agente (não bloqueia o servidor)
  try {
    await bootstrapAgents();
  } catch (err) {
    console.error("❌ Falha no boot dos agentes:", err instanceof Error ? err.message : err);
    console.warn("⚠️ O servidor continuará rodando, mas alguns agentes podem estar indisponíveis.");
  }
});