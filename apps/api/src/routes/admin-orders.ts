import type { Context } from "hono";
import { updateOrderFulfillmentSchema } from "@b2ccoop/store-shared";
import { createDb } from "../db/client";
import { storeAdminAuth } from "../middleware/store-admin-auth";
import type { StoreAdminVariables } from "../middleware/store-admin-auth";
import {
  confirmFulfillmentAndPostLedger,
  listPendingFulfillmentOrders,
  OrderError,
  updateOrderFulfillmentStatus,
} from "../services/orders";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export const adminAuth = storeAdminAuth();

type AdminContext = Context<{ Bindings: WorkerEnv; Variables: StoreAdminVariables }>;

export async function getAdminPendingOrders(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const orders = await listPendingFulfillmentOrders(db);
    return c.json({ count: orders.length, orders });
  } finally {
    await close();
  }
}

export async function patchAdminOrderFulfillment(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const orderId = c.req.param("id");
  if (!orderId) {
    return c.json({ error: "Order id required" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updateOrderFulfillmentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const order = await updateOrderFulfillmentStatus(db, orderId, undefined, parsed.data.status);
    return c.json({ ok: true, order });
  } catch (err) {
    if (err instanceof OrderError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}

export async function patchConfirmPickup(c: AdminContext) {
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
    const result = await confirmFulfillmentAndPostLedger(db, c.env, orderId);
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
