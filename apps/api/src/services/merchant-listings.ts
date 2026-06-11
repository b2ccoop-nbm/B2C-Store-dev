import { and, desc, eq, inArray } from "drizzle-orm";
import type { StoreDatabase } from "../db/client";
import { products, vendors } from "../db/schema";

export class MerchantListingError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "MerchantListingError";
  }
}

export type CreateListingInput = {
  vendorCode: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: string;
  patronagePerUnit?: string;
  submitForReview?: boolean;
};

function money(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new MerchantListingError("Invalid price");
  }
  return n.toFixed(2);
}

function derivePricing(unitPrice: string, patronagePerUnit: string) {
  const unit = Number(unitPrice);
  const patronage = Number(patronagePerUnit) || 0;
  const sales = Math.max(unit - patronage * 0.5, 0);
  const vendorPayable = Math.max(sales * 0.75, 0);
  return {
    salesPerUnit: sales.toFixed(2),
    vendorPayablePerUnit: vendorPayable.toFixed(2),
    patronagePerUnit: patronage.toFixed(2),
  };
}

async function getVendorByCode(db: StoreDatabase, vendorCode: string) {
  const rows = await db.select().from(vendors).where(eq(vendors.code, vendorCode)).limit(1);
  const vendor = rows[0];
  if (!vendor) {
    throw new MerchantListingError("Vendor not found", 404);
  }
  if (!vendor.isActive) {
    throw new MerchantListingError("Vendor is not active", 409);
  }
  return vendor;
}

export async function listMerchantListings(db: StoreDatabase, vendorCode: string) {
  const vendor = await getVendorByCode(db, vendorCode);
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.vendorId, vendor.id))
    .orderBy(desc(products.updatedAt));

  return rows.map((row) => serializeListing(row, vendor.code));
}

export async function createMerchantListing(db: StoreDatabase, input: CreateListingInput) {
  const vendor = await getVendorByCode(db, input.vendorCode);
  const sku = input.sku.trim().toUpperCase().replace(/\s+/g, "-");
  const name = input.name.trim();
  const category = input.category.trim() || "General";

  if (!sku || !name) {
    throw new MerchantListingError("SKU and name are required");
  }

  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.vendorId, vendor.id), eq(products.sku, sku)))
    .limit(1);

  if (existing.length > 0) {
    throw new MerchantListingError("SKU already exists for this seller", 409);
  }

  const unitPrice = money(input.unitPrice);
  const pricing = derivePricing(unitPrice, input.patronagePerUnit ?? "0");
  const listingStatus = input.submitForReview ? "PENDING_REVIEW" : "DRAFT";
  const isActive = false;

  const inserted = await db
    .insert(products)
    .values({
      vendorId: vendor.id,
      sku,
      name,
      category,
      unitPrice,
      salesPerUnit: pricing.salesPerUnit,
      vendorPayablePerUnit: pricing.vendorPayablePerUnit,
      patronagePerUnit: pricing.patronagePerUnit,
      listingStatus,
      isActive,
    })
    .returning();

  return serializeListing(inserted[0]!, vendor.code);
}

export async function listPendingReviewListings(db: StoreDatabase) {
  const rows = await db
    .select({
      product: products,
      vendorCode: vendors.code,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(inArray(products.listingStatus, ["PENDING_REVIEW", "DRAFT"]))
    .orderBy(desc(products.updatedAt));

  return rows.map((row) => serializeListing(row.product, row.vendorCode));
}

export async function approveListing(db: StoreDatabase, vendorCode: string, sku: string) {
  const vendor = await getVendorByCode(db, vendorCode);
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.vendorId, vendor.id), eq(products.sku, sku)))
    .limit(1);
  const product = rows[0];
  if (!product) {
    throw new MerchantListingError("Listing not found", 404);
  }
  if (product.listingStatus === "ACTIVE") {
    return serializeListing(product, vendor.code);
  }

  const updated = await db
    .update(products)
    .set({
      listingStatus: "ACTIVE",
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(products.id, product.id))
    .returning();

  return serializeListing(updated[0]!, vendor.code);
}

function serializeListing(row: typeof products.$inferSelect, vendorCode: string) {
  return {
    vendorCode,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unitPrice: row.unitPrice,
    patronagePerUnit: row.patronagePerUnit,
    currency: row.currency,
    listingStatus: row.listingStatus,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}
