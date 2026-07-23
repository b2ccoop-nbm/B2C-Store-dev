import type { Context } from "hono";
import { createDb } from "../db/client";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";
import { OrderError, syncOnlineOrderPayment } from "../services/orders";

export async function postOrderSyncPayment(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const orderId = c.req.param("id");
  if (!orderId) {
    return c.json({ error: "Order id required" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const result = await syncOnlineOrderPayment(db, c.env, orderId);
    return c.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrderError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}
