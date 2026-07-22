import type { Context } from "hono";
import { adminApproveListingSchema, adminUpdateVendorCommerceSchema } from "@b2ccoop/store-shared";
import { createDb } from "../db/client";
import type { StoreAdminVariables } from "../middleware/store-admin-auth";
import {
  approveSellerApplication,
  listPendingSellerApplications,
  rejectSellerApplication,
  SellerApplicationError,
} from "../services/seller-applications";
import {
  approveListing,
  listPendingReviewListings,
  MerchantListingError,
} from "../services/merchant-listings";
import { rotateVendorToken, listActiveVendors, VendorError } from "../services/vendors";
import {
  adminUpdateVendorCommerce,
  approveVendorProfileChange,
  listPendingProfileChanges,
  MerchantProfileError,
} from "../services/merchant-profile";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

type AdminContext = Context<{ Bindings: WorkerEnv; Variables: StoreAdminVariables }>;

export async function getAdminPendingApplications(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const applications = await listPendingSellerApplications(db);
    return c.json({ count: applications.length, applications });
  } finally {
    await close();
  }
}

export async function patchApproveApplication(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const applicationId = c.req.param("id");
  if (!applicationId) {
    return c.json({ error: "Application id required" }, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const reviewNotes = typeof body.reviewNotes === "string" ? body.reviewNotes : undefined;

  const { db, close } = createDb(dbUrl);
  try {
    const result = await approveSellerApplication(db, c.env, applicationId, reviewNotes);
    return c.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SellerApplicationError) {
      return c.json({ error: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : "Approve failed";
    console.error("[patchApproveApplication]", err);
    return c.json({ error: message }, 500);
  } finally {
    await close();
  }
}

export async function patchRejectApplication(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const applicationId = c.req.param("id");
  if (!applicationId) {
    return c.json({ error: "Application id required" }, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const reviewNotes = typeof body.reviewNotes === "string" ? body.reviewNotes : undefined;

  const { db, close } = createDb(dbUrl);
  try {
    const application = await rejectSellerApplication(db, applicationId, reviewNotes);
    return c.json({ ok: true, application });
  } catch (err) {
    if (err instanceof SellerApplicationError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}

export async function getAdminPendingListings(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const listings = await listPendingReviewListings(db);
    return c.json({ count: listings.length, listings });
  } finally {
    await close();
  }
}

export async function patchApproveListing(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = c.req.param("vendorCode");
  const sku = c.req.param("sku");
  if (!vendorCode || !sku) {
    return c.json({ error: "vendorCode and sku required" }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = adminApproveListingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const listing = await approveListing(db, vendorCode, sku, parsed.data);
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

export async function getAdminVendors(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const rows = await listActiveVendors(db);
    const vendors = rows.map((v) => ({
      code: v.code,
      slug: v.slug,
      name: v.name,
      ownerEmail: v.ownerEmail,
      createdAt: v.createdAt.toISOString(),
    }));
    return c.json({ count: vendors.length, vendors });
  } finally {
    await close();
  }
}

export async function getAdminPendingProfileChanges(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const changes = await listPendingProfileChanges(db);
    return c.json({ count: changes.length, changes });
  } finally {
    await close();
  }
}

export async function patchApproveVendorProfile(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = c.req.param("code");
  if (!vendorCode) {
    return c.json({ error: "Vendor code required" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const profile = await approveVendorProfileChange(db, vendorCode);
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

export async function patchAdminVendorCommerce(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = c.req.param("code");
  if (!vendorCode) {
    return c.json({ error: "Vendor code required" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = adminUpdateVendorCommerceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const profile = await adminUpdateVendorCommerce(db, vendorCode, parsed.data);
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

export async function patchRotateVendorToken(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = c.req.param("code");
  if (!vendorCode) {
    return c.json({ error: "Vendor code required" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const result = await rotateVendorToken(db, vendorCode);
    return c.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof VendorError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}
