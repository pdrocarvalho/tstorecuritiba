import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { OAuth2Client } from "google-auth-library";

const app = express();
const PORT = process.env.PORT || 3000;

// 🚀 PASSO 1: SEGURANÇA NO TOPO (COOP & COEP)
// Definimos os cabeçalhos ANTES de qualquer outro middleware ou rota.
app.use((_req, res, next) => {
  // Permite a comunicação entre seu site e o popup do Google
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  // Previne bloqueios de carregamento de recursos externos (como a foto do usuário)
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

// Middlewares padrão
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

// Inicializa a ferramenta do Google
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Endpoint de Login via Google
app.post("/api/auth/login", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Token do Google não fornecido." });
  }

  try {
    // 1. O Google verifica se o token é autêntico
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    
    // 2. Extraímos os dados da conta
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ message: "E-mail não encontrado na conta Google." });
    }

    const { email, name, picture } = payload;

    // Role padrão para o sistema
    const role = "admin"; 

    // 4. Criamos o token interno (JWT)
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

// Endpoint de Validação de Sessão
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

export type AppRouter = typeof appRouter;

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
  })
);

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});