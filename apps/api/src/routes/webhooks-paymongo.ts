import type { Context } from "hono";
import { createDb } from "../db/client";
import { verifyPaymongoWebhookSignature } from "../integrations/paymongo-client";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";
import {
  fulfillOnlinePayment,
  OrderError,
  resolveOrderForPaymongoWebhook,
} from "../services/orders";

type PaymongoWebhookPayload = {
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      type?: string;
      data?: {
        id?: string;
        type?: string;
        attributes?: {
          reference_number?: string;
        };
      };
    };
  };
};

const PAID_EVENT_TYPES = new Set([
  "checkout_session.payment.paid",
  "checkout_session.completed",
]);

function parsePaymongoWebhook(payload: PaymongoWebhookPayload) {
  const eventType = payload.data?.attributes?.type ?? payload.data?.type ?? "";
  const inner = payload.data?.attributes?.data;
  const reference = inner?.attributes?.reference_number?.trim() ?? "";
  const innerType = inner?.type ?? "";
  const sessionId =
    innerType === "checkout_session" || inner?.id?.startsWith("cs_")
      ? inner?.id?.trim() ?? ""
      : "";
  return {
    eventType,
    reference,
    sessionId,
    eventId: payload.data?.id,
  };
}

export async function postPaymongoWebhook(c: Context<{ Bindings: WorkerEnv }>) {
  const secret = c.env.PAYMONGO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return c.json({ error: "PayMongo webhook not configured" }, 503);
  }

  const rawBody = await c.req.text();
  const signature = c.req.header("paymongo-signature") ?? c.req.header("Paymongo-Signature");
  const liveMode = c.env.PAYMONGO_SECRET_KEY?.startsWith("sk_live_") ?? false;

  const valid = await verifyPaymongoWebhookSignature(rawBody, signature, secret, liveMode);
  if (!valid) {
    return c.json({ error: "Invalid webhook signature" }, 401);
  }

  let payload: PaymongoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PaymongoWebhookPayload;
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const { eventType, reference, sessionId, eventId } = parsePaymongoWebhook(payload);
  if (!PAID_EVENT_TYPES.has(eventType)) {
    return c.json({ received: true, ignored: eventType || "unknown" });
  }

  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const order = await resolveOrderForPaymongoWebhook(db, { reference, sessionId });
    if (!order) {
      return c.json({ error: "Order not found for PayMongo webhook" }, 404);
    }

    const result = await fulfillOnlinePayment(db, c.env, order.externalId, eventId);
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
