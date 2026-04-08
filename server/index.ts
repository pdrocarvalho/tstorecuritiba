import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers"; // <-- A MÁGICA ESTÁ AQUI! Importamos as rotas reais

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// Utilizadores em memória (Apenas para fase de testes)
const TEST_USERS = [
  { id: 1, email: "admin@tstore.com", password: "admin123", role: "admin", name: "Admin" },
  { id: 2, email: "consultor@tstore.com", password: "consultor123", role: "user", name: "Consultor" },
];

// Health check (Para o Render saber que estamos online)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Endpoint de Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = TEST_USERS.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ message: "Credenciais inválidas." });
  
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  return res.json({ token, role: user.role, name: user.name });
});

// Endpoint de Validação de Sessão (Me)
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

// Exporta o tipo para o Frontend saber quais rotas existem
export type AppRouter = typeof appRouter;

// Regista as rotas reais do tRPC no Express
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
  })
);

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});