import type { Context } from "hono";
import { createDb } from "../db/client";
import { devAdminAuth } from "../middleware/dev-admin";
import {
  confirmPickupAndPostLedger,
  listPendingPickupOrders,
  OrderError,
} from "../services/orders";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export const adminAuth = devAdminAuth();

export async function getAdminPendingOrders(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const orders = await listPendingPickupOrders(db);
    return c.json({ count: orders.length, orders });
  } finally {
    await close();
  }
}

export async function patchConfirmPickup(c: Context<{ Bindings: WorkerEnv }>) {
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
    const result = await confirmPickupAndPostLedger(db, c.env, orderId);
    return c.json(result);
  } catch (err) {
    if (err instanceof OrderError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}
