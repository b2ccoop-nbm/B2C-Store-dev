import type { Context } from "hono";
import { createListingRequestSchema } from "@b2ccoop/store-shared";
import { createDb } from "../db/client";
import { devAdminAuth } from "../middleware/dev-admin";
import { getVendorCode, requireVendorCode } from "../middleware/merchant-scope";
import {
  createMerchantListing,
  listMerchantListings,
  MerchantListingError,
} from "../services/merchant-listings";
import { listPendingPickupOrders } from "../services/orders";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export const merchantAuth = devAdminAuth();

export async function getMerchantListings(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = getVendorCode(c);
  const { db, close } = createDb(dbUrl);
  try {
    const listings = await listMerchantListings(db, vendorCode);
    return c.json({ count: listings.length, listings });
  } finally {
    await close();
  }
}

export async function postMerchantListing(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = getVendorCode(c);
  const body = await c.req.json().catch(() => null);
  const parsed = createListingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const listing = await createMerchantListing(db, {
      vendorCode,
      ...parsed.data,
    });
    return c.json({ ok: true, listing }, 201);
  } catch (err) {
    if (err instanceof MerchantListingError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}

export async function getMerchantPendingOrders(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = getVendorCode(c);
  const { db, close } = createDb(dbUrl);
  try {
    const orders = await listPendingPickupOrders(db, vendorCode);
    return c.json({ vendorCode, count: orders.length, orders });
  } finally {
    await close();
  }
}

export const merchantVendorScope = requireVendorCode();
