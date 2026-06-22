import { and, eq, isNotNull } from "drizzle-orm";
import type { StoreDatabase } from "../db/client";
import { vendors } from "../db/schema";
import { slugify } from "../lib/slug";
import type { UpdateMerchantProfileRequest } from "@b2ccoop/store-shared";

export class MerchantProfileError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "MerchantProfileError";
  }
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
