import type { Context } from "hono";
import { createDb } from "../db/client";
import { verifyFirebaseIdToken } from "../lib/firebase-auth";
import {
  getSellerApplicationByEmail,
  getSellerApplicationByFirebaseUid,
} from "../services/seller-applications";
import {
  getVendorByFirebaseUid,
  getVendorByOwnerEmail,
} from "../services/vendors";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

function parseFirebaseBearer(c: Context): string {
  const header = c.req.header("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** Member merchant context — requires Firebase ID token in Authorization header. */
export async function getMemberMerchantContext(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const idToken = parseFirebaseBearer(c);
  if (!idToken) {
    return c.json({ error: "Authorization Bearer token required" }, 401);
  }

  const firebaseUser = await verifyFirebaseIdToken(c.env, idToken);
  if (!firebaseUser) {
    return c.json({ error: "Invalid Firebase session" }, 401);
  }

  const { db, close } = createDb(dbUrl);
  try {
    let vendor =
      (await getVendorByFirebaseUid(db, firebaseUser.uid)) ??
      (await getVendorByOwnerEmail(db, firebaseUser.email));

    let application =
      (await getSellerApplicationByFirebaseUid(db, firebaseUser.uid)) ??
      (await getSellerApplicationByEmail(db, firebaseUser.email));

    return c.json({
      ok: true,
      member: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
      },
      isApprovedVendor: Boolean(vendor),
      vendor: vendor
        ? { code: vendor.code, slug: vendor.slug, name: vendor.name, linked: Boolean(vendor.firebaseUid) }
        : null,
      application: application
        ? {
            applicationId: application.applicationId,
            status: application.status,
            businessName: application.businessName,
            proposedVendorCode: application.proposedVendorCode,
          }
        : null,
    });
  } finally {
    await close();
  }
}
