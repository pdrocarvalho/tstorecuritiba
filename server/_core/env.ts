import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url("A URL do banco de dados (DATABASE_URL) deve ser uma URL válida."),
  JWT_SECRET: z.string().min(32, "A JWT_SECRET deve ter no mínimo 32 caracteres para ser segura em produção."),
  GOOGLE_CLIENT_ID: z.string().min(1, "O GOOGLE_CLIENT_ID é obrigatório para o login."),
  GOOGLE_SERVICE_EMAIL: z.string().email("O GOOGLE_SERVICE_EMAIL deve ser um e-mail válido."),
  GOOGLE_PRIVATE_KEY: z.string().min(1, "A GOOGLE_PRIVATE_KEY é obrigatória."),
  FRONTEND_URL: z.string().url().optional(),
  DB_SPREADSHEET_ID: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  APPS_SCRIPT_WEBHOOK_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
