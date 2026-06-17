import { syncHistory, syncLogs, type InsertSyncLog } from "../../drizzle/schema";
import { requireDb } from "../db";

export async function recordSyncHistory(params: {
  sheetsUrl: string;
  syncedBy: number;
  novosPedidos: number;
  novasPrevisoes: number;
  chegadas: number;
  status: "sucesso" | "erro";
  mensagemErro?: string;
}): Promise<boolean> {
  const db = await requireDb("syncHistory");
  await db.insert(syncHistory).values(params);
  return true;
}

export async function insertSyncLog(log: InsertSyncLog): Promise<void> {
  const db = await requireDb("syncLogs");
  await db.insert(syncLogs).values(log);
}
