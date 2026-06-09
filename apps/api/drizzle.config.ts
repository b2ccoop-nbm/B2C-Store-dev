import { defineConfig } from "drizzle-kit";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5434/b2ccoop_store";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
