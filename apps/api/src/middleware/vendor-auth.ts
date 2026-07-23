import type { Context, Next } from "hono";
import { createDb } from "../db/client";
import { verifyFirebaseIdToken } from "../lib/firebase-auth";
import { isVendorTokenFormat } from "../lib/vendor-token";
import {
  getVendorByToken,
  resolveMerchantVendorForFirebaseUser,
} from "../services/vendors";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export type MerchantAuthMode = "vendor_token" | "firebase_sso" | "dev_admin";

export type MerchantVariables = {
  merchantAuthMode: MerchantAuthMode;
  vendorCode: string;
};

function parseBearer(c: Context): string {
  const header = c.req.header("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function legacyStaffSecretOk(
  c: Context<{ Bindings: WorkerEnv; Variables: MerchantVariables }>,
  token: string,
): boolean {
  const expected = c.env.DEV_ADMIN_SECRET?.trim();
  return Boolean(expected && token === expected);
}

/** Authenticate merchant API: Firebase member SSO, per-vendor token, or dev staff secret. */
export function merchantAuth() {
  return async (c: Context<{ Bindings: WorkerEnv; Variables: MerchantVariables }>, next: Next) => {
    const token = parseBearer(c);
    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const dbUrl = resolveDatabaseUrl(c.env);
    if (dbUrl) {
      const { db, close } = createDb(dbUrl);
      try {
        if (isVendorTokenFormat(token)) {
          const vendor = await getVendorByToken(db, token);
          if (vendor) {
            c.set("merchantAuthMode", "vendor_token");
            c.set("vendorCode", vendor.code);
            await next();
            return;
          }
        } else {
          const firebaseUser = await verifyFirebaseIdToken(c.env, token);
          if (firebaseUser) {
            const vendor = await resolveMerchantVendorForFirebaseUser(
              db,
              firebaseUser.uid,
              firebaseUser.email,
            );
            if (vendor) {
              c.set("merchantAuthMode", "firebase_sso");
              c.set("vendorCode", vendor.code);
              await next();
              return;
            }
          }
        }
      } finally {
        await close();
      }
    }

    // Legacy staff-secret impersonation is dev-only — production vendors use Firebase SSO or tokens.
    if (c.env.ENVIRONMENT === "production") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!legacyStaffSecretOk(c, token)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const vendorCode = c.req.header("X-Vendor-Code")?.trim();
    if (!vendorCode) {
      return c.json({ error: "X-Vendor-Code header required for staff secret auth" }, 400);
    }

    c.set("merchantAuthMode", "dev_admin");
    c.set("vendorCode", vendorCode);
    await next();
  };
}

export function getMerchantVendorCode(c: Context): string {
  return (c.get("vendorCode") as string | undefined) ?? "";
}
