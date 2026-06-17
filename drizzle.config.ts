import type { Config } from "drizzle-kit";

export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: "postgresql://postgres:10362701%40Drope@db.twtpdrfnmefkiohilnwz.supabase.co:5432/postgres",
  },
} satisfies Config;
