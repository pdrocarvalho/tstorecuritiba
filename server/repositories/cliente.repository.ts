import { clientes } from "../../drizzle/schema";
import { requireDb } from "../db";

export async function getClientes() {
  const db = await requireDb("clientes");
  return await db.select().from(clientes);
}
