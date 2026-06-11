import type { Context } from "hono";
import { createDb } from "../db/client";
import { getStorefrontBySlug, StorefrontError } from "../services/storefront";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export async function getStorefront(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const slug = c.req.param("slug");
  if (!slug) {
    return c.json({ error: "Store slug required" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const storefront = await getStorefrontBySlug(db, slug);
    return c.json(storefront);
  } catch (err) {
    if (err instanceof StorefrontError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}
