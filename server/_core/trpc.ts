/**
 * server/_core/trpc.ts
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";
import { env } from "./env";

const JWT_SECRET = env.JWT_SECRET;

// Contexto criado a cada requisição — lê o token do header Authorization
export function createContext({ req }: CreateExpressContextOptions) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) return { user: null };

  try {
    const user = jwt.verify(token, JWT_SECRET) as {
      sub: number | string;
      email: string;
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

// Apenas administradores podem chamar
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado. Apenas administradores podem realizar esta ação.",
    });
  }
  return next({ ctx });
});