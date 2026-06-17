import { produtos, type InsertProduto } from "../../drizzle/schema";
import { requireDb } from "../db";

export async function upsertProduto(produto: InsertProduto): Promise<void> {
  const db = await requireDb("produtos");
  await db.insert(produtos).values(produto).onConflictDoUpdate({
    target: produtos.sku,
    set: { descricao: produto.descricao },
  });
}
