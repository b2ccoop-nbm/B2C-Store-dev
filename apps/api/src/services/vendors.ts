import { eq } from "drizzle-orm";
import type { StoreDatabase } from "../db/client";
import { vendors } from "../db/schema";
import { generateVendorToken, hashVendorToken } from "../lib/vendor-token";

export class VendorError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "VendorError";
  }
}

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

export async function getVendorByFirebaseUid(db: StoreDatabase, firebaseUid: string) {
  const rows = await db
    .select({
      id: vendors.id,
      code: vendors.code,
      slug: vendors.slug,
      name: vendors.name,
      ownerEmail: vendors.ownerEmail,
      firebaseUid: vendors.firebaseUid,
      isActive: vendors.isActive,
    })
    .from(vendors)
    .where(eq(vendors.firebaseUid, firebaseUid.trim()))
    .limit(1);

  const vendor = rows[0];
  if (!vendor || !vendor.isActive) return null;
  return vendor;
}

export async function getVendorByOwnerEmail(db: StoreDatabase, email: string) {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select({
      id: vendors.id,
      code: vendors.code,
      slug: vendors.slug,
      name: vendors.name,
      ownerEmail: vendors.ownerEmail,
      firebaseUid: vendors.firebaseUid,
      isActive: vendors.isActive,
    })
    .from(vendors)
    .where(eq(vendors.ownerEmail, normalized))
    .limit(1);

  const vendor = rows[0];
  if (!vendor || !vendor.isActive) return null;
  return vendor;
}

export async function bindVendorFirebaseUid(
  db: StoreDatabase,
  vendorCode: string,
  firebaseUid: string,
  ownerEmail: string,
) {
  const vendor = await getVendorByCode(db, vendorCode);
  if (!vendor) {
    throw new VendorError("Vendor not found", 404);
  }

  const rows = await db
    .select({ ownerEmail: vendors.ownerEmail, firebaseUid: vendors.firebaseUid })
    .from(vendors)
    .where(eq(vendors.code, vendorCode))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new VendorError("Vendor not found", 404);
  }

  const normalizedOwner = ownerEmail.trim().toLowerCase();
  if (row.ownerEmail?.toLowerCase() !== normalizedOwner) {
    throw new VendorError("Signed-in email does not match store owner", 403);
  }

  if (row.firebaseUid && row.firebaseUid !== firebaseUid) {
    throw new VendorError("Store is already linked to another member account", 409);
  }

  const conflict = await db
    .select({ code: vendors.code })
    .from(vendors)
    .where(eq(vendors.firebaseUid, firebaseUid))
    .limit(1);
  if (conflict[0] && conflict[0].code !== vendorCode) {
    throw new VendorError("Member account is already linked to another store", 409);
  }

  await db
    .update(vendors)
    .set({ firebaseUid, updatedAt: new Date() })
    .where(eq(vendors.code, vendorCode));

  return {
    code: vendor.code,
    slug: vendor.slug,
    name: vendor.name,
    firebaseUid,
  };
}

export async function rotateVendorToken(db: StoreDatabase, vendorCode: string) {
  const rows = await db
    .select({ id: vendors.id, code: vendors.code, slug: vendors.slug, name: vendors.name })
    .from(vendors)
    .where(eq(vendors.code, vendorCode.trim()))
    .limit(1);

  const vendor = rows[0];
  if (!vendor) {
    throw new VendorError("Vendor not found", 404);
  }

  const accessToken = generateVendorToken();
  const apiTokenHash = await hashVendorToken(accessToken);

  await db
    .update(vendors)
    .set({ apiTokenHash, updatedAt: new Date() })
    .where(eq(vendors.id, vendor.id));

  return {
    vendor: {
      code: vendor.code,
      slug: vendor.slug,
      name: vendor.name,
    },
    accessToken,
  };
}
