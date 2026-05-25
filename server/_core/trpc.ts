/**
 * server/_core/trpc.ts
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// Contexto criado a cada requisição — lê o token do header Authorization
export function createContext({ req }: CreateExpressContextOptions) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) return { user: null };

  try {
    const user = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    return { user };
  } catch {
    return { user: null };
  }
}

export type Context = ReturnType<typeof createContext>;

const t = initTRPC.context<Context>().create();

export const router = t.router;

// Qualquer um pode chamar (ex: health checks futuros)
export const publicProcedure = t.procedure;

// Só usuários com token JWT válido podem chamar
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Você precisa estar autenticado para realizar esta ação.",
    });
  }
  return next({ ctx: { user: ctx.user } });
});