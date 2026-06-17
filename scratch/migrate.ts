import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as path from "path";
import * as fs from "fs";

async function runMigration() {
  console.log("Iniciando migração no Supabase...");
  const configRaw = fs.readFileSync(path.resolve(__dirname, "../drizzle.config.json"), "utf8");
  const config = JSON.parse(configRaw);
  let connString = config.dbCredentials.connectionString;
  
  if (!connString) {
    throw new Error("DATABASE_URL não configurada.");
  }
  if (connString.includes("?")) {
    connString = connString.split("?")[0];
  }
  
  const pool = new Pool({
    connectionString: connString,
    ssl: { rejectUnauthorized: false }
  });

  const db = drizzle(pool);

  try {
    // 1. Limpa registros órfãos que causariam violação de foreign key (ex: ID 1 não existe em consultores)
    console.log("Limpando referências órfãs em pedidos_rastreio...");
    await pool.query(`UPDATE pedidos_rastreio SET consultor_id = NULL WHERE consultor_id NOT IN (SELECT id FROM consultores);`);
    await pool.query(`UPDATE pedidos_rastreio SET cliente_id = NULL WHERE cliente_id NOT IN (SELECT id FROM clientes);`);

    // 2. Aplica as migrações (Cria as Foreign Keys via Drizzle)
    await migrate(db, { migrationsFolder: path.resolve(__dirname, "../drizzle/migrations") });
    console.log("Migrações concluídas com sucesso!");
  } catch (err) {
    console.error("Erro na migração:", err);
  } finally {
    await pool.end();
  }
}

runMigration();
