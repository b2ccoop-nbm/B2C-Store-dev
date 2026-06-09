import type { Context } from "hono";
import { checkoutRequestSchema } from "@b2ccoop/store-shared";
import { createDb } from "../db/client";
import { CheckoutError, createCheckoutOrder } from "../services/checkout";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export async function postCheckout(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { db, close } = createDb(dbUrl);

  try {
    const result = await createCheckoutOrder(db, c.env, parsed.data);
    return c.json(result, 201);
  } catch (err) {
    if (err instanceof CheckoutError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}
