import { eq } from "drizzle-orm";
import { googleSheetsConfig } from "../../drizzle/schema";
import { getDb, requireDb } from "../db";

export async function getGoogleSheetsConfig() {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(googleSheetsConfig).limit(1);
    return result[0] ?? null;
  } catch (error) {
    console.error("[DB] Erro ao buscar configuração do Sheets:", error);
    return null;
  }
}

export async function saveGoogleSheetsConfig(
  sheetsUrl: string, 
  configuredBy: number, 
  fileName?: string
): Promise<boolean> {
  const db = await requireDb("sheetsConfig");
  try {
    const existing = await getGoogleSheetsConfig();
    if (existing) {
      await db.update(googleSheetsConfig)
        .set({ sheetsUrl, fileName: fileName ?? existing.fileName, updatedAt: new Date() })
        .where(eq(googleSheetsConfig.id, existing.id));
    } else {
      await db.insert(googleSheetsConfig).values({ sheetsUrl, configuredBy, fileName });
    }
    return true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("[Postgres] Erro ao salvar configurações:", error.message);
      throw new Error(error.message);
    } else {
      console.error("[Postgres] Erro ao salvar configurações:", error);
      throw new Error("Erro desconhecido ao salvar configurações");
    }
  }
}
