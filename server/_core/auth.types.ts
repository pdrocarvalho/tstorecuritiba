/**
 * server/_core/auth.types.ts
 * 
 * Tipos compartilhados de autenticação entre Client e Server.
 */

export type UserRole = "admin" | "user";

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  name: string | null;
}

export interface AppJwtPayload {
  sub: number;
  email: string;
  role: UserRole;
}
