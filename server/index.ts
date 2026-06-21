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
import { DataSyncAgent } from "./agents/data-sync.agent";

/**
 * ENDPOINTS DE AUTENTICAÇÃO REST
 */
app.post("/api/auth/login", login);
app.get("/api/auth/me", me);

/**
 * ENDPOINTS DOS AGENTES (TRIGGERS MANUAIS)
 */
app.post("/api/agents/data-sync", async (req, res) => {
  try {
    const urls = {
      avarias: process.env.SHEET_ID_AVARIAS,
      demandas: process.env.SHEET_ID_DEMANDAS,
      recebimentos: process.env.SHEET_ID_RECEBIMENTOS
    };

    if (!urls.avarias && !urls.demandas && !urls.recebimentos) {
      return res.status(400).json({ error: "Nenhum SHEET_ID configurado no .env." });
    }
    
    // Roda o Agente em background (sem aguardar o término para não travar o painel)
    // Se quiser que aguarde, adicione await e retorne o resultado.
    const result = await DataSyncAgent.runFullSync(urls);
    
    res.json(result);
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

// Início do Servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🔒 Domínio permitido: @${DOMINIO_PERMITIDO}`);
  console.log(`✉️  E-mails de exceção: ${EMAILS_EXCECAO.join(", ")}`);
});