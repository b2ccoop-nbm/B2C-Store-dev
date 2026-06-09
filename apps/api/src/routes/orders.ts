import type { Context } from "hono";
import { createDb } from "../db/client";
import { getOrderById } from "../services/orders";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export async function getOrder(c: Context<{ Bindings: WorkerEnv }>) {
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
    const order = await getOrderById(db, orderId);
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    return c.json(order);
  } finally {
    await close();
  }
}
