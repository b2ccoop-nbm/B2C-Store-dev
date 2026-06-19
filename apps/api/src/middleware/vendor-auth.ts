import type { Context, Next } from "hono";
import { createDb } from "../db/client";
import { getVendorByToken } from "../services/vendors";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export type MerchantAuthMode = "vendor_token" | "dev_admin";

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

/** Authenticate merchant API: per-vendor token (production) or legacy DEV_ADMIN_SECRET + X-Vendor-Code (dev). */
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
        const vendor = await getVendorByToken(db, token);
        if (vendor) {
          c.set("merchantAuthMode", "vendor_token");
          c.set("vendorCode", vendor.code);
          await next();
          return;
        }
      } finally {
        await close();
      }
    }

    // Legacy staff-secret impersonation is dev-only — production vendors use per-vendor tokens.
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
