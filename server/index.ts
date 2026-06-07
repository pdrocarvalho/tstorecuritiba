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
import { upsertUser, getUserByOpenId } from "./db";

const app = express();
const PORT = process.env.PORT || 3000;

const DOMINIO_PERMITIDO = "tramontinastore.com";
const EMAILS_EXCECAO = ["pdrolcarvalho@gmail.com"];

// MIDDLEWARE DE SEGURANÇA (COOP/COEP) - DEVE SER O PRIMEIRO
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Check de saúde do servidor
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * ENDPOINT: Login via Google
 */
app.post("/api/auth/login", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Token do Google não fornecido." });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ message: "E-mail não encontrado na conta Google." });
    }

    const { email, name, picture } = payload;

    // 1. Valida o domínio — permite @tramontinastore.com e e-mails de exceção
    if (!email.endsWith(`@${DOMINIO_PERMITIDO}`) && !EMAILS_EXCECAO.includes(email)) {
      return res.status(403).json({
        message: `Acesso negado. Apenas contas @${DOMINIO_PERMITIDO} podem acessar esta plataforma.`
      });
    }

    // 2. Garante que o usuário existe no banco (cria se for o primeiro login)
    await upsertUser({
      openId: email,
      email,
      name: name ?? null,
      loginMethod: "google",
    });

    // 3. Busca o usuário para pegar o role real
    const dbUser = await getUserByOpenId(email);
    const role = dbUser?.role ?? "user";

    // 4. Assina o JWT com o role real do banco
    const authToken = jwt.sign(
      { id: email, email, role, name, picture },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ token: authToken, role, name, picture });
  } catch (error) {
    console.error("Erro na verificação do Google:", error);
    return res.status(401).json({ message: "Token do Google inválido ou expirado." });
  }
});

/**
 * ENDPOINT: Validação de Sessão
 */
app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Não autenticado." });

  try {
    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json(decoded);
  } catch {
    return res.status(401).json({ message: "Token inválido." });
  }
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