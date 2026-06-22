import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { createListingRequestSchema, updateMerchantProfileSchema } from "@b2ccoop/store-shared";
import { createDb } from "../db/client";
import { orders } from "../db/schema";
import { getVendorCode, requireMerchantVendor } from "../middleware/merchant-scope";
import { getMerchantVendorCode as getAuthVendorCode, merchantAuth } from "../middleware/vendor-auth";
import { getVendorByCode } from "../services/vendors";
import {
  createMerchantListing,
  listMerchantListings,
  MerchantListingError,
} from "../services/merchant-listings";
import {
  getMerchantProfile,
  MerchantProfileError,
  updateMerchantProfile,
} from "../services/merchant-profile";
import { confirmPickupAndPostLedger, listPendingPickupOrders, OrderError } from "../services/orders";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";
import type { MerchantVariables } from "../middleware/vendor-auth";

export { merchantAuth };
export const merchantVendorScope = requireMerchantVendor();

type MerchantContext = Context<{ Bindings: WorkerEnv; Variables: MerchantVariables }>;

/** Validate bearer token and return vendor identity (for credential setup). */
export async function getMerchantSession(c: MerchantContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = getAuthVendorCode(c);
  const { db, close } = createDb(dbUrl);
  try {
    const vendor = await getVendorByCode(db, vendorCode);
    if (!vendor) {
      return c.json({ error: "Vendor not found" }, 404);
    }
    return c.json({
      ok: true,
      vendor: {
        code: vendor.code,
        slug: vendor.slug,
        name: vendor.name,
      },
    });
  } finally {
    await close();
  }
}

export async function getMerchantProfileRoute(c: MerchantContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = getVendorCode(c);
  const { db, close } = createDb(dbUrl);
  try {
    const profile = await getMerchantProfile(db, vendorCode);
    return c.json({ ok: true, profile });
  } catch (err) {
    if (err instanceof MerchantProfileError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}

export async function patchMerchantProfileRoute(c: MerchantContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = getVendorCode(c);
  const body = await c.req.json().catch(() => null);
  const parsed = updateMerchantProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const result = await updateMerchantProfile(db, vendorCode, parsed.data);
    return c.json({
      ok: true,
      profile: result.profile,
      nameChangePending: result.nameChangePending,
      message: result.nameChangePending
        ? "Business name change submitted for coop officer review."
        : "Store profile updated.",
    });
  } catch (err) {
    if (err instanceof MerchantProfileError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}

export async function getMerchantListings(c: MerchantContext) {
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

export async function postMerchantListing(c: MerchantContext) {
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

export async function getMerchantPendingOrders(c: MerchantContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = getVendorCode(c);
  const { db, close } = createDb(dbUrl);
  try {
    const ordersList = await listPendingPickupOrders(db, vendorCode);
    return c.json({ vendorCode, count: ordersList.length, orders: ordersList });
  } finally {
    await close();
  }
}

export async function patchMerchantConfirmPickup(c: MerchantContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const orderId = c.req.param("id");
  if (!orderId) {
    return c.json({ error: "Order id required" }, 400);
  }

  const vendorCode = getVendorCode(c);
  const { db, close } = createDb(dbUrl);
  try {
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    const order = orderRows[0];
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.vendorCode !== vendorCode) {
      return c.json({ error: "Order does not belong to your store" }, 403);
    }

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
