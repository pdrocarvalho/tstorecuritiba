import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (_db) return _db;
  if (!env.DATABASE_URL) {
    console.warn("[DB] DATABASE_URL não definida.");
    return null;
  }
  try {
    // Limpa parâmetros extras (como sslmode) para o Render não dar conflito com o código
    let connString = env.DATABASE_URL;
    if (connString.includes("?")) {
      connString = connString.split("?")[0];
    }
    
    const isSupabase = connString.includes("supabase");
    
    const pool = new Pool({ 
      connectionString: connString,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    });
    _db = drizzle(pool);
  } catch (error) {
    console.error("[DB] Falha crítica ao conectar:", error);
    _db = null;
  }
  return _db;
}

export async function requireDb(context: string) {
  const db = await getDb();
  if (!db) throw new Error(`[DB:${context}] Banco de dados indisponível.`);
  return db;
}