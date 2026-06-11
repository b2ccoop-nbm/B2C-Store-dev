import type { Context } from "hono";
import { createDb } from "../db/client";
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
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export async function getAdminPendingApplications(c: Context<{ Bindings: WorkerEnv }>) {
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

export async function patchApproveApplication(c: Context<{ Bindings: WorkerEnv }>) {
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
    const result = await approveSellerApplication(db, applicationId, reviewNotes);
    return c.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SellerApplicationError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}

export async function patchRejectApplication(c: Context<{ Bindings: WorkerEnv }>) {
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

export async function getAdminPendingListings(c: Context<{ Bindings: WorkerEnv }>) {
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

export async function patchApproveListing(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const vendorCode = c.req.param("vendorCode");
  const sku = c.req.param("sku");
  if (!vendorCode || !sku) {
    return c.json({ error: "vendorCode and sku required" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const listing = await approveListing(db, vendorCode, sku);
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
