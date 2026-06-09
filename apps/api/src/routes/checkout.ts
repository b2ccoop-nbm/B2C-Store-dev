import type { Context } from "hono";
import { checkoutRequestSchema } from "@b2ccoop/store-shared";
import { createDb } from "../db/client";
import { verifyFirebaseIdToken } from "../lib/firebase-auth";
import { normalizeEmail } from "../lib/member-resolve";
import { verifyTurnstile } from "../lib/turnstile";
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

  const turnstile = await verifyTurnstile(
    c.env,
    parsed.data.turnstileToken,
    c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim(),
  );
  if (!turnstile.ok) {
    return c.json({ error: turnstile.error }, 400);
  }

  if (parsed.data.firebaseIdToken) {
    const firebaseUser = await verifyFirebaseIdToken(c.env, parsed.data.firebaseIdToken);
    if (!firebaseUser) {
      return c.json({ error: "Invalid Firebase session" }, 401);
    }
    if (normalizeEmail(parsed.data.email) !== firebaseUser.email) {
      return c.json({ error: "Checkout email must match signed-in member" }, 400);
    }
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
