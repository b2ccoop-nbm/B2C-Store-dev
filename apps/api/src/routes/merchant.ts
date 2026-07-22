import type { Context } from "hono";
import { eq } from "drizzle-orm";
import {
  createListingRequestSchema,
  updateListingRequestSchema,
  updateMerchantProfileSchema,
  updateOrderFulfillmentSchema,
} from "@b2ccoop/store-shared";
import { createDb } from "../db/client";
import { orders } from "../db/schema";
import { getVendorCode, requireMerchantVendor } from "../middleware/merchant-scope";
import { getMerchantVendorCode as getAuthVendorCode, merchantAuth } from "../middleware/vendor-auth";
import { getVendorByCode } from "../services/vendors";
import {
  createMerchantListing,
  deleteMerchantListing,
  listMerchantListings,
  MerchantListingError,
  updateMerchantListing,
} from "../services/merchant-listings";
import { ProductImageError, uploadProductImage } from "../services/product-image";
import {
  getMerchantProfile,
  MerchantProfileError,
  updateMerchantProfile,
} from "../services/merchant-profile";
import {
  confirmFulfillmentAndPostLedger,
  listPendingFulfillmentOrders,
  OrderError,
  updateOrderFulfillmentStatus,
} from "../services/orders";
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
    const listings = await listMerchantListings(db, vendorCode, c.env);
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

export async function patchMerchantListing(c: MerchantContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = getVendorCode(c);
  const sku = c.req.param("sku");
  if (!sku?.trim()) {
    return c.json({ error: "SKU required" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updateListingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  if (Object.keys(parsed.data).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const listing = await updateMerchantListing(db, c.env, {
      vendorCode,
      sku,
      ...parsed.data,
    });
    return c.json({ ok: true, listing });
  } catch (err) {
    if (err instanceof MerchantListingError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}

export async function deleteMerchantListingRoute(c: MerchantContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = getVendorCode(c);
  const sku = c.req.param("sku");
  if (!sku?.trim()) {
    return c.json({ error: "SKU required" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const result = await deleteMerchantListing(db, vendorCode, sku);
    return c.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof MerchantListingError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}

export async function postMerchantListingImage(c: MerchantContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = getVendorCode(c);
  const sku = c.req.param("sku");
  if (!sku?.trim()) {
    return c.json({ error: "SKU required" }, 400);
  }

  const body = await c.req.parseBody();
  const file = body.image;
  if (!(file instanceof File)) {
    return c.json({ error: "Multipart field image is required" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const result = await uploadProductImage(c.env, db, vendorCode, sku, file);
    return c.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ProductImageError) {
      return c.json({ error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : "Image upload failed";
    console.error("[postMerchantListingImage]", err);
    return c.json({ error: message }, 500);
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
    const ordersList = await listPendingFulfillmentOrders(db, vendorCode);
    return c.json({ vendorCode, count: ordersList.length, orders: ordersList });
  } finally {
    await close();
  }
}

export async function patchMerchantFulfillment(c: MerchantContext) {
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

  const vendorCode = getVendorCode(c);
  const { db, close } = createDb(dbUrl);
  try {
    const order = await updateOrderFulfillmentStatus(
      db,
      orderId,
      vendorCode,
      parsed.data.status,
    );
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
