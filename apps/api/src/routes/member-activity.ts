import type { Context } from "hono";
import { createDb } from "../db/client";
import { getStorePatronageSummary, listOrdersByEmail } from "../services/member-activity";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export async function getOrdersByEmail(c: Context<{ Bindings: WorkerEnv }>) {
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
    const orders = await listOrdersByEmail(db, email);
    const active = orders.filter((o) => o.bucket === "active");
    const completed = orders.filter((o) => o.bucket === "completed");
    return c.json({
      email: email.trim().toLowerCase(),
      count: orders.length,
      activeCount: active.length,
      completedCount: completed.length,
      orders,
    });
  } finally {
    await close();
  }
}

export async function getMemberStorePatronage(c: Context<{ Bindings: WorkerEnv }>) {
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
    const summary = await getStorePatronageSummary(db, email);
    return c.json(summary);
  } finally {
    await close();
  }
}
