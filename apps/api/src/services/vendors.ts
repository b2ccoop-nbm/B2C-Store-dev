import { eq } from "drizzle-orm";
import type { StoreDatabase } from "../db/client";
import { vendors } from "../db/schema";
import { hashVendorToken } from "../lib/vendor-token";

export async function getVendorByToken(db: StoreDatabase, bearerToken: string) {
  const tokenHash = await hashVendorToken(bearerToken);
  const rows = await db
    .select({
      id: vendors.id,
      code: vendors.code,
      slug: vendors.slug,
      name: vendors.name,
      isActive: vendors.isActive,
    })
    .from(vendors)
    .where(eq(vendors.apiTokenHash, tokenHash))
    .limit(1);

  const vendor = rows[0];
  if (!vendor || !vendor.isActive) return null;
  return vendor;
}

export async function getVendorByCode(db: StoreDatabase, vendorCode: string) {
  const rows = await db
    .select({
      id: vendors.id,
      code: vendors.code,
      slug: vendors.slug,
      name: vendors.name,
      isActive: vendors.isActive,
    })
    .from(vendors)
    .where(eq(vendors.code, vendorCode))
    .limit(1);

  const vendor = rows[0];
  if (!vendor || !vendor.isActive) return null;
  return vendor;
}
