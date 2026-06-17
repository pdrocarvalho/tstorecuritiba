import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { tasks } from "../drizzle/schema";

const DATABASE_URL = "postgresql://postgres:10362701%40Drope@db.twtpdrfnmefkiohilnwz.supabase.co:5432/postgres";

async function clearTasks() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);

  console.log("Limpando tabela de tarefas...");
  await db.delete(tasks);
  console.log("Tarefas limpas com sucesso.");

  await pool.end();
  process.exit(0);
}

clearTasks();
