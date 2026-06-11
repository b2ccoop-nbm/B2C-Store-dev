import { and, eq } from "drizzle-orm";
import type { StoreDatabase } from "../db/client";
import { products, vendors } from "../db/schema";

export class StorefrontError extends Error {
  constructor(
    message: string,
    readonly status: 404 = 404,
  ) {
    super(message);
    this.name = "StorefrontError";
  }
}

export async function getStorefrontBySlug(db: StoreDatabase, slug: string) {
  const normalized = slug.trim().toLowerCase();
  const vendorRows = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.slug, normalized), eq(vendors.isActive, true)))
    .limit(1);

  const vendor = vendorRows[0];
  if (!vendor) {
    throw new StorefrontError("Store not found");
  }

  const itemRows = await db
    .select({
      vendorCode: vendors.code,
      vendorSlug: vendors.slug,
      sku: products.sku,
      name: products.name,
      category: products.category,
      unitPrice: products.unitPrice,
      patronagePerUnit: products.patronagePerUnit,
      currency: products.currency,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(
      and(
        eq(products.vendorId, vendor.id),
        eq(products.isActive, true),
        eq(products.listingStatus, "ACTIVE"),
      ),
    );

  const items = itemRows
    .map((row) => ({
      vendorCode: row.vendorCode,
      vendorSlug: row.vendorSlug,
      sku: row.sku,
      name: row.name,
      category: row.category,
      unitPrice: row.unitPrice,
      patronagePerUnit: row.patronagePerUnit,
      currency: row.currency,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    slug: vendor.slug,
    vendorCode: vendor.code,
    name: vendor.name,
    description: vendor.description,
    listingCount: items.length,
    currency: "PHP",
    items,
  };
}
