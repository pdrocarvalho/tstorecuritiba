import { eq } from "drizzle-orm";
import { users, type InsertUser } from "../../drizzle/schema";
import { requireDb } from "../db";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("[DB:users] openId é obrigatório.");
  const db = await requireDb("users");
  await db.insert(users).values(user).onConflictDoUpdate({
    target: users.openId,
    set: { name: user.name, email: user.email, lastSignedIn: new Date() },
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await requireDb("users");
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

export async function updateUserRole(openId: string, role: "user" | "admin"): Promise<void> {
  const db = await requireDb("users");
  await db.update(users).set({ role }).where(eq(users.openId, openId));
}
