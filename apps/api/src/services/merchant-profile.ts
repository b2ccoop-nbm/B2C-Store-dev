import { and, eq, isNotNull } from "drizzle-orm";
import type { AdminUpdateVendorCommerceRequest, UpdateMerchantProfileRequest } from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { vendors } from "../db/schema";
import { slugify } from "../lib/slug";

export class MerchantProfileError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "MerchantProfileError";
  }
}

function optionalMoney(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new MerchantProfileError("Invalid delivery rate");
  }
  return n.toFixed(2);
}

function optionalPercent(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new MerchantProfileError("Invalid listing fee percent");
  }
  return n.toFixed(2);
}

function serializeProfile(row: typeof vendors.$inferSelect) {
  return {
    code: row.code,
    slug: row.slug,
    name: row.name,
    description: row.description,
    email: row.email,
    ownerEmail: row.ownerEmail,
    contactPhone: row.contactPhone,
    businessType: row.businessType as "product" | "service" | "farm" | "food",
    sellerKind: row.sellerKind,
    pickupEnabled: row.pickupEnabled,
    pickupAddress: row.pickupAddress,
    pickupLandmark: row.pickupLandmark,
    pickupHours: row.pickupHours,
    pickupInstructions: row.pickupInstructions,
    pickupPhone: row.pickupPhone,
    deliveryPerItem: row.deliveryPerItem,
    partnerListingFeePercent: row.partnerListingFeePercent,
    pendingName: row.pendingName,
    pendingSlug: row.pendingSlug,
  };
}

async function getVendorRow(db: StoreDatabase, vendorCode: string) {
  const rows = await db.select().from(vendors).where(eq(vendors.code, vendorCode)).limit(1);
  const vendor = rows[0];
  if (!vendor || !vendor.isActive) {
    throw new MerchantProfileError("Vendor not found", 404);
  }
  return vendor;
}

async function uniqueVendorSlug(db: StoreDatabase, base: string, excludeVendorId: string): Promise<string> {
  let slug = base;
  let suffix = 1;
  while (true) {
    const existing = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.slug, slug))
      .limit(1);
    if (!existing[0] || existing[0].id === excludeVendorId) return slug;
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
}

function applyCommerceFields(
  updates: Partial<typeof vendors.$inferInsert>,
  input: UpdateMerchantProfileRequest,
) {
  if (input.pickupEnabled !== undefined) {
    updates.pickupEnabled = input.pickupEnabled;
    if (!input.pickupEnabled) {
      updates.pickupAddress = null;
      updates.pickupLandmark = null;
      updates.pickupHours = null;
      updates.pickupInstructions = null;
      updates.pickupPhone = null;
    }
  }
  if (input.pickupAddress !== undefined) updates.pickupAddress = input.pickupAddress?.trim() || null;
  if (input.pickupLandmark !== undefined) updates.pickupLandmark = input.pickupLandmark?.trim() || null;
  if (input.pickupHours !== undefined) updates.pickupHours = input.pickupHours?.trim() || null;
  if (input.pickupInstructions !== undefined) {
    updates.pickupInstructions = input.pickupInstructions?.trim() || null;
  }
  if (input.pickupPhone !== undefined) updates.pickupPhone = input.pickupPhone?.trim() || null;
  if (input.deliveryPerItem !== undefined) {
    updates.deliveryPerItem = optionalMoney(input.deliveryPerItem);
  }
  if (input.partnerListingFeePercent !== undefined) {
    updates.partnerListingFeePercent = optionalPercent(input.partnerListingFeePercent);
  }
}

export async function getMerchantProfile(db: StoreDatabase, vendorCode: string) {
  const vendor = await getVendorRow(db, vendorCode);
  return serializeProfile(vendor);
}

export async function updateMerchantProfile(
  db: StoreDatabase,
  vendorCode: string,
  input: UpdateMerchantProfileRequest,
) {
  const vendor = await getVendorRow(db, vendorCode);
  const updates: Partial<typeof vendors.$inferInsert> = {
    updatedAt: new Date(),
  };
  let nameChangePending = false;

  if (input.description !== undefined) {
    updates.description = input.description?.trim() || null;
  }
  if (input.email !== undefined) {
    updates.email = input.email.trim().toLowerCase();
  }
  if (input.contactPhone !== undefined) {
    updates.contactPhone = input.contactPhone?.trim() || null;
  }
  if (input.businessType !== undefined) {
    updates.businessType = input.businessType;
  }

  applyCommerceFields(updates, input);

  if (input.pickupEnabled === true) {
    const address = input.pickupAddress ?? vendor.pickupAddress;
    if (!address?.trim()) {
      throw new MerchantProfileError("Pickup address is required when pickup is enabled");
    }
  }

  if (input.name !== undefined) {
    const nextName = input.name.trim();
    if (!nextName) {
      throw new MerchantProfileError("Business name is required");
    }
    if (nextName !== vendor.name) {
      const baseSlug = slugify(nextName);
      if (!baseSlug) {
        throw new MerchantProfileError("Business name must include letters or numbers");
      }
      const pendingSlug = await uniqueVendorSlug(db, baseSlug, vendor.id);
      updates.pendingName = nextName;
      updates.pendingSlug = pendingSlug;
      nameChangePending = true;
    }
  }

  const updated = await db
    .update(vendors)
    .set(updates)
    .where(eq(vendors.id, vendor.id))
    .returning();

  return {
    profile: serializeProfile(updated[0]!),
    nameChangePending,
  };
}

export async function adminUpdateVendorCommerce(
  db: StoreDatabase,
  vendorCode: string,
  input: AdminUpdateVendorCommerceRequest,
) {
  const vendor = await getVendorRow(db, vendorCode);
  const updates: Partial<typeof vendors.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.sellerKind !== undefined) {
    updates.sellerKind = input.sellerKind;
  }
  if (input.deliveryPerItem !== undefined) {
    updates.deliveryPerItem = optionalMoney(input.deliveryPerItem);
  }
  if (input.partnerListingFeePercent !== undefined) {
    updates.partnerListingFeePercent = optionalPercent(input.partnerListingFeePercent);
  }

  const updated = await db
    .update(vendors)
    .set(updates)
    .where(eq(vendors.id, vendor.id))
    .returning();

  return serializeProfile(updated[0]!);
}

export async function listPendingProfileChanges(db: StoreDatabase) {
  const rows = await db
    .select({
      code: vendors.code,
      slug: vendors.slug,
      name: vendors.name,
      pendingName: vendors.pendingName,
      pendingSlug: vendors.pendingSlug,
      ownerEmail: vendors.ownerEmail,
      updatedAt: vendors.updatedAt,
    })
    .from(vendors)
    .where(and(eq(vendors.isActive, true), isNotNull(vendors.pendingName)))
    .orderBy(vendors.updatedAt);

  return rows
    .filter((row) => row.pendingName)
    .map((row) => ({
      code: row.code,
      currentName: row.name,
      currentSlug: row.slug,
      pendingName: row.pendingName!,
      pendingSlug: row.pendingSlug!,
      ownerEmail: row.ownerEmail,
      updatedAt: row.updatedAt.toISOString(),
    }));
}

export async function approveVendorProfileChange(db: StoreDatabase, vendorCode: string) {
  const vendor = await getVendorRow(db, vendorCode);
  if (!vendor.pendingName || !vendor.pendingSlug) {
    throw new MerchantProfileError("No pending profile change for this vendor", 409);
  }

  const conflict = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.slug, vendor.pendingSlug))
    .limit(1);
  if (conflict[0] && conflict[0].id !== vendor.id) {
    throw new MerchantProfileError("Pending storefront URL is no longer available", 409);
  }

  const updated = await db
    .update(vendors)
    .set({
      name: vendor.pendingName,
      slug: vendor.pendingSlug,
      pendingName: null,
      pendingSlug: null,
      updatedAt: new Date(),
    })
    .where(eq(vendors.id, vendor.id))
    .returning();

  return serializeProfile(updated[0]!);
}
