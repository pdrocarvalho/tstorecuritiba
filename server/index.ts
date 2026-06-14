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
import { upsertUser, getUserByOpenId, updateUserRole } from "./db";

const app = express();
const PORT = process.env.PORT || 3000;

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
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Permite deploys preview da Vercel apenas em ambiente que não seja produção estrita
    if (origin.endsWith('.vercel.app') && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    callback(new Error('Origem não permitida pela política de CORS'));
  },
  credentials: true
}));
app.use(express.json());

if (!process.env.JWT_SECRET) {
  throw new Error("❌ FATAL: A variável de ambiente JWT_SECRET não está definida. O servidor não pode iniciar sem ela.");
}
const JWT_SECRET = process.env.JWT_SECRET;
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

    // 3. Sincroniza a role com base na lista de administradores
    const roleEsperada = ADMIN_EMAILS.includes(email) ? "admin" : "user";
    await updateUserRole(email, roleEsperada);

    const role = roleEsperada;

    // 4. Busca o ID numérico do banco para usar como 'sub' no JWT
    const dbUser = await getUserByOpenId(email);

    // 5. Assina o JWT apenas com dados de autorização (SEC-08)
    const authToken = jwt.sign(
      { sub: dbUser?.id ?? email, email, role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ token: authToken, role, name });
  } catch (error) {
    console.error("Erro na verificação do Google:", error);
    return res.status(401).json({ message: "Token do Google inválido ou expirado." });
  }
});

/**
 * ENDPOINT: Validação de Sessão
 */
app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Não autenticado." });

  try {
    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: number | string; email: string; role: string };

    // Busca nome atualizado do banco (não armazenado no JWT)
    const dbUser = await getUserByOpenId(decoded.email);

    return res.json({
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: dbUser?.name ?? "Usuário",
    });
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