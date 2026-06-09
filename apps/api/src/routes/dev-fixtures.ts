import type { Context } from "hono";
import { DEV_SAMPLE_ORDERS, DEV_SHOPPERS, DEV_STAFF } from "../db/seed-dev-fixtures";
import { DEMO_CART_SKUS } from "../db/seed-data";
import type { WorkerEnv } from "../env";

export async function getDevFixtures(c: Context<{ Bindings: WorkerEnv }>) {
  if (c.env.ENVIRONMENT === "production") {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({
    shoppers: DEV_SHOPPERS,
    staff: DEV_STAFF,
    sampleOrders: DEV_SAMPLE_ORDERS.map((o) => ({
      id: o.id,
      externalId: o.externalId,
      guestEmail: o.guestEmail,
      participantId: o.participantId,
      status: o.status,
      grossAmount: o.grossAmount,
      patronageAmount: o.patronageAmount,
    })),
    demoCart: DEMO_CART_SKUS,
    devAdminSecret: "Set DEV_ADMIN_SECRET in apps/api/.dev.vars (local staff API — Phase 1c)",
    firebaseProject: "b2ccoop-87114",
    docs: "docs/DEV-TESTING.md",
  });
}
