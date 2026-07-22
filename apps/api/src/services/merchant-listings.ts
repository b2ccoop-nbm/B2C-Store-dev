import { and, desc, eq, inArray } from "drizzle-orm";
import {
  buildListingSku,
  listingSkuBaseFromName,
  normalizeListingSkuBase,
} from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { products, vendors } from "../db/schema";
import type { WorkerEnv } from "../env";
import { resolvePublicImageUrl } from "../lib/product-image-url";
import { migrateProductImageForSkuChange } from "./product-image";

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
  sku?: string;
  name: string;
  category: string;
  unitPrice: string;
  patronagePerUnit?: string;
  submitForReview?: boolean;
};

export type UpdateListingInput = {
  vendorCode: string;
  sku: string;
  name?: string;
  category?: string;
  unitPrice?: string;
  patronagePerUnit?: string;
  skuBase?: string;
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

function normalizeSkuParam(sku: string): string {
  return sku.trim().toUpperCase().replace(/\s+/g, "-");
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

async function getProductForVendor(db: StoreDatabase, vendorId: string, sku: string) {
  const normalizedSku = normalizeSkuParam(sku);
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.vendorId, vendorId), eq(products.sku, normalizedSku)))
    .limit(1);
  const product = rows[0];
  if (!product) {
    throw new MerchantListingError("Listing not found", 404);
  }
  return product;
}

async function skuExistsForVendor(db: StoreDatabase, vendorId: string, sku: string): Promise<boolean> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.vendorId, vendorId), eq(products.sku, sku)))
    .limit(1);
  return rows.length > 0;
}

function resolveSkuBase(input: CreateListingInput): string {
  if (input.sku?.trim()) {
    return normalizeListingSkuBase(input.sku);
  }
  return listingSkuBaseFromName(input.name);
}

async function assignUniqueSku(
  db: StoreDatabase,
  vendorId: string,
  base: string,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const at = new Date(Date.now() + attempt * 1000);
    const sku = buildListingSku(base, at);
    if (!(await skuExistsForVendor(db, vendorId, sku))) {
      return sku;
    }
  }
  throw new MerchantListingError("Could not assign a unique SKU — try again", 409);
}

export async function listMerchantListings(db: StoreDatabase, vendorCode: string, env: WorkerEnv) {
  const vendor = await getVendorByCode(db, vendorCode);
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.vendorId, vendor.id))
    .orderBy(desc(products.updatedAt));

  return rows.map((row) => serializeListing(row, vendor.code, env));
}

export async function createMerchantListing(db: StoreDatabase, input: CreateListingInput) {
  const vendor = await getVendorByCode(db, input.vendorCode);
  const name = input.name.trim();
  const category = input.category.trim() || "General";

  if (!name) {
    throw new MerchantListingError("Product name is required");
  }

  const sku = await assignUniqueSku(db, vendor.id, resolveSkuBase(input));
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

export async function updateMerchantListing(
  db: StoreDatabase,
  env: WorkerEnv,
  input: UpdateListingInput,
) {
  const vendor = await getVendorByCode(db, input.vendorCode);
  const product = await getProductForVendor(db, vendor.id, input.sku);

  const patch: Partial<typeof products.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new MerchantListingError("Product name is required");
    patch.name = name;
  }

  if (input.category !== undefined) {
    patch.category = input.category.trim() || "General";
  }

  if (input.unitPrice !== undefined) {
    const unitPrice = money(input.unitPrice);
    const patronage = input.patronagePerUnit ?? product.patronagePerUnit;
    const pricing = derivePricing(unitPrice, patronage);
    patch.unitPrice = unitPrice;
    patch.salesPerUnit = pricing.salesPerUnit;
    patch.vendorPayablePerUnit = pricing.vendorPayablePerUnit;
    patch.patronagePerUnit = pricing.patronagePerUnit;
  } else if (input.patronagePerUnit !== undefined) {
    const pricing = derivePricing(product.unitPrice, input.patronagePerUnit);
    patch.salesPerUnit = pricing.salesPerUnit;
    patch.vendorPayablePerUnit = pricing.vendorPayablePerUnit;
    patch.patronagePerUnit = pricing.patronagePerUnit;
  }

  if (input.submitForReview === true && product.listingStatus !== "ACTIVE") {
    patch.listingStatus = "PENDING_REVIEW";
    patch.isActive = false;
  }

  if (input.skuBase?.trim()) {
    const newBase = normalizeListingSkuBase(input.skuBase);
    const currentBase = normalizeListingSkuBase(product.sku);
    if (newBase !== currentBase) {
      nextSku = await assignUniqueSku(db, vendor.id, newBase);
      patch.sku = nextSku;

      if (product.imageUrl) {
        patch.imageUrl = await migrateProductImageForSkuChange(
          env,
          vendor.code,
          product.sku,
          nextSku,
          product.imageUrl,
        );
      }
    }
  }

  const updated = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, product.id))
    .returning();

  return serializeListing(updated[0]!, vendor.code, env);
}

export async function deleteMerchantListing(db: StoreDatabase, vendorCode: string, sku: string) {
  const vendor = await getVendorByCode(db, vendorCode);
  const product = await getProductForVendor(db, vendor.id, sku);

  if (product.listingStatus === "ACTIVE" && product.isActive) {
    const updated = await db
      .update(products)
      .set({
        isActive: false,
        listingStatus: "REJECTED",
        updatedAt: new Date(),
      })
      .where(eq(products.id, product.id))
      .returning();

    return {
      mode: "deactivated" as const,
      listing: serializeListing(updated[0]!, vendor.code),
    };
  }

  await db.delete(products).where(eq(products.id, product.id));
  return {
    mode: "deleted" as const,
    sku: product.sku,
  };
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
  const product = await getProductForVendor(db, vendor.id, sku);

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

function serializeListing(row: typeof products.$inferSelect, vendorCode: string, env?: WorkerEnv) {
  return {
    vendorCode,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unitPrice: row.unitPrice,
    patronagePerUnit: row.patronagePerUnit,
    currency: row.currency,
    imageUrl: env ? resolvePublicImageUrl(env, row.imageUrl) : row.imageUrl ?? null,
    listingStatus: row.listingStatus,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}
