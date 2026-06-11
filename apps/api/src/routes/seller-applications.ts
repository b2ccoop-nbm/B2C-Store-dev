import type { Context } from "hono";
import { sellerApplicationRequestSchema } from "@b2ccoop/store-shared";
import { createDb } from "../db/client";
import {
  getSellerApplicationByEmail,
  SellerApplicationError,
  submitSellerApplication,
} from "../services/seller-applications";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export async function postSellerApplication(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = sellerApplicationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const application = await submitSellerApplication(db, parsed.data);
    return c.json({ ok: true, application }, 201);
  } catch (err) {
    if (err instanceof SellerApplicationError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}

export async function getSellerApplicationStatus(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const email = c.req.query("email")?.trim();
  if (!email) {
    return c.json({ error: "email query parameter required" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const application = await getSellerApplicationByEmail(db, email);
    if (!application) {
      return c.json({ found: false });
    }
    return c.json({ found: true, application });
  } finally {
    await close();
  }
}
