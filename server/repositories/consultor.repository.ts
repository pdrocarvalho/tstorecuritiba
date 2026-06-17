import { consultores } from "../../drizzle/schema";
import { requireDb } from "../db";

export async function getConsultores() {
  const db = await requireDb("consultores");
  return await db.select().from(consultores);
}
