import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { OAuth2Client } from "google-auth-library";

const app = express();
const PORT = process.env.PORT || 3000;

// 🚀 MIDDLEWARE DE SEGURANÇA (COOP/COEP) - DEVE SER O PRIMEIRO
// Isso resolve o erro de bloqueio de popup do Google e fotos de perfil.
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

// Middlewares de processamento
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

// Inicializa a ferramenta do Google
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
    // 1. O Google verifica se o token enviado pelo frontend é autêntico
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    
    // 2. Extraímos os dados do usuário do ticket do Google
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ message: "E-mail não encontrado na conta Google." });
    }

    const { email, name, picture } = payload;

    // 3. Define o nível de acesso (Role)
    const role = "admin"; 

    // 4. Gera o token JWT interno da aplicação (válido por 7 dias)
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

// Integração com tRPC
export type AppRouter = typeof appRouter;

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
  })
);

// Início do Servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🔒 Política COOP configurada para popups do Google.`);
});