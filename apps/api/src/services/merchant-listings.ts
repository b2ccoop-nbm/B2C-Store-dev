import { and, desc, eq, inArray } from "drizzle-orm";
import {
  buildListingSku,
  computeListingPricing,
  effectiveDeliveryPerItem,
  listingSkuBaseFromName,
  normalizeListingSkuBase,
  type DeliveryTier,
  type PlatformCommerceSettings,
} from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { products, vendors } from "../db/schema";
import type { WorkerEnv } from "../env";
import { resolvePublicImageUrl } from "../lib/product-image-url";
import { migrateProductImageForSkuChange } from "./product-image";
import { getPlatformSettings } from "./platform-settings";

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
  listingFeePercent?: string;
  deliveryTier?: DeliveryTier;
  deliveryPerItem?: string;
  patronageEligible?: boolean;
  submitForReview?: boolean;
};

export type UpdateListingInput = {
  vendorCode: string;
  sku: string;
  name?: string;
  category?: string;
  unitPrice?: string;
  listingFeePercent?: string | null;
  deliveryTier?: DeliveryTier;
  deliveryPerItem?: string | null;
  patronageEligible?: boolean;
  skuBase?: string;
  submitForReview?: boolean;
};

export type AdminApproveListingInput = {
  listingFeePercent?: string;
  deliveryPerItem?: string | null;
  deliveryTier?: DeliveryTier;
};

function money(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new MerchantListingError("Invalid price");
  }
  return n.toFixed(2);
}

function optionalMoney(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new MerchantListingError("Invalid delivery rate");
  }
  return n.toFixed(2);
}

function optionalPercent(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new MerchantListingError("Invalid listing fee percent");
  }
  return n.toFixed(2);
}

function resolveListingFeePercent(
  productFee: string | null | undefined,
  vendorFee: string | null | undefined,
  inputFee: string | undefined,
): number | null {
  if (inputFee != null && inputFee !== "") return Number(inputFee);
  if (productFee != null && productFee !== "") return Number(productFee);
  if (vendorFee != null && vendorFee !== "") return Number(vendorFee);
  return null;
}

async function computeProductPricing(
  db: StoreDatabase,
  vendor: typeof vendors.$inferSelect,
  srp: string,
  options: {
    listingFeePercent?: string | null;
    deliveryTier?: DeliveryTier;
    deliveryPerItem?: string | null;
    patronageEligible?: boolean;
  } = {},
) {
  const platform = await getPlatformSettings(db);
  const sellerKind = vendor.sellerKind;
  const listingFeePercent = resolveListingFeePercent(
    null,
    vendor.partnerListingFeePercent,
    options.listingFeePercent ?? undefined,
  );

  const pricing = computeListingPricing({
    srp: Number(srp),
    sellerKind,
    listingFeePercent,
    platform,
    patronageEligible: options.patronageEligible,
  });

  const tier = options.deliveryTier ?? "standard";
  const deliveryPerItem = optionalMoney(options.deliveryPerItem);
  const effectiveDelivery = effectiveDeliveryPerItem(
    platform,
    tier,
    vendor.deliveryPerItem,
    deliveryPerItem,
  );

  return { pricing, tier, deliveryPerItem, effectiveDelivery, platform };
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
  const platform = await getPlatformSettings(db);
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.vendorId, vendor.id))
    .orderBy(desc(products.updatedAt));

  return rows.map((row) => serializeListing(row, vendor, platform, env));
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
  const listingFeePercent = optionalPercent(input.listingFeePercent);
  const deliveryPerItem = optionalMoney(input.deliveryPerItem);
  const deliveryTier = input.deliveryTier ?? "standard";
  const patronageEligible = input.patronageEligible ?? true;

  const { pricing, effectiveDelivery } = await computeProductPricing(db, vendor, unitPrice, {
    listingFeePercent,
    deliveryTier,
    deliveryPerItem,
    patronageEligible,
  });

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
      listingFeePercent: pricing.listingFeePercent,
      deliveryPerItem,
      deliveryTier,
      patronageEligible,
      listingStatus,
      isActive,
    })
    .returning();

  const platform = await getPlatformSettings(db);
  const listing = serializeListing(inserted[0]!, vendor, platform);
  return { ...listing, effectiveDeliveryPerItem: effectiveDelivery };
}

export async function updateMerchantListing(
  db: StoreDatabase,
  env: WorkerEnv,
  input: UpdateListingInput,
) {
  const vendor = await getVendorByCode(db, input.vendorCode);
  const product = await getProductForVendor(db, vendor.id, input.sku);
  const platform = await getPlatformSettings(db);

  const patch: Partial<typeof products.$inferInsert> = {
    updatedAt: new Date(),
  };
  let nextSku: string | undefined;

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new MerchantListingError("Product name is required");
    patch.name = name;
  }

  if (input.category !== undefined) {
    patch.category = input.category.trim() || "General";
  }

  if (input.deliveryTier !== undefined) {
    patch.deliveryTier = input.deliveryTier;
  }

  if (input.deliveryPerItem !== undefined) {
    patch.deliveryPerItem = optionalMoney(input.deliveryPerItem);
  }

  if (input.patronageEligible !== undefined) {
    patch.patronageEligible = input.patronageEligible;
  }

  if (input.listingFeePercent !== undefined) {
    patch.listingFeePercent = optionalPercent(input.listingFeePercent);
  }

  const repricingNeeded =
    input.unitPrice !== undefined ||
    input.listingFeePercent !== undefined ||
    input.patronageEligible !== undefined;

  if (repricingNeeded) {
    const srp = input.unitPrice !== undefined ? money(input.unitPrice) : product.unitPrice;
    const fee =
      input.listingFeePercent !== undefined
        ? optionalPercent(input.listingFeePercent)
        : product.listingFeePercent;
    const patronageEligible = input.patronageEligible ?? product.patronageEligible;
    const { pricing } = await computeProductPricing(db, vendor, srp, {
      listingFeePercent: fee,
      deliveryTier: (input.deliveryTier ?? product.deliveryTier) as DeliveryTier,
      deliveryPerItem:
        input.deliveryPerItem !== undefined ? optionalMoney(input.deliveryPerItem) : product.deliveryPerItem,
      patronageEligible,
    });
    patch.unitPrice = srp;
    patch.salesPerUnit = pricing.salesPerUnit;
    patch.vendorPayablePerUnit = pricing.vendorPayablePerUnit;
    patch.patronagePerUnit = pricing.patronagePerUnit;
    patch.listingFeePercent = pricing.listingFeePercent;
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

  return serializeListing(updated[0]!, vendor, platform, env);
}

export async function deleteMerchantListing(db: StoreDatabase, vendorCode: string, sku: string) {
  const vendor = await getVendorByCode(db, vendorCode);
  const product = await getProductForVendor(db, vendor.id, sku);
  const platform = await getPlatformSettings(db);

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
      listing: serializeListing(updated[0]!, vendor, platform),
    };
  }

  await db.delete(products).where(eq(products.id, product.id));
  return {
    mode: "deleted" as const,
    sku: product.sku,
  };
}

export async function listPendingReviewListings(db: StoreDatabase) {
  const platform = await getPlatformSettings(db);
  const rows = await db
    .select({
      product: products,
      vendor: vendors,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(inArray(products.listingStatus, ["PENDING_REVIEW", "DRAFT"]))
    .orderBy(desc(products.updatedAt));

  return rows.map((row) => serializeListing(row.product, row.vendor, platform));
}

export async function approveListing(
  db: StoreDatabase,
  vendorCode: string,
  sku: string,
  overrides: AdminApproveListingInput = {},
) {
  const vendor = await getVendorByCode(db, vendorCode);
  const product = await getProductForVendor(db, vendor.id, sku);
  const platform = await getPlatformSettings(db);

  const patch: Partial<typeof products.$inferInsert> = {
    listingStatus: "ACTIVE",
    isActive: true,
    updatedAt: new Date(),
  };

  if (overrides.deliveryTier !== undefined) {
    patch.deliveryTier = overrides.deliveryTier;
  }
  if (overrides.deliveryPerItem !== undefined) {
    patch.deliveryPerItem = optionalMoney(overrides.deliveryPerItem);
  }
  if (overrides.listingFeePercent !== undefined) {
    patch.listingFeePercent = optionalPercent(overrides.listingFeePercent);
  }

  const needsRepricing =
    overrides.listingFeePercent !== undefined ||
    overrides.deliveryPerItem !== undefined ||
    overrides.deliveryTier !== undefined;

  if (needsRepricing) {
    const { pricing } = await computeProductPricing(db, vendor, product.unitPrice, {
      listingFeePercent: patch.listingFeePercent ?? product.listingFeePercent,
      deliveryTier: (patch.deliveryTier ?? product.deliveryTier) as DeliveryTier,
      deliveryPerItem:
        patch.deliveryPerItem !== undefined ? patch.deliveryPerItem : product.deliveryPerItem,
      patronageEligible: product.patronageEligible,
    });
    patch.salesPerUnit = pricing.salesPerUnit;
    patch.vendorPayablePerUnit = pricing.vendorPayablePerUnit;
    patch.patronagePerUnit = pricing.patronagePerUnit;
    patch.listingFeePercent = pricing.listingFeePercent;
  }

  if (product.listingStatus === "ACTIVE" && !needsRepricing) {
    return serializeListing(product, vendor, platform);
  }

  const updated = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, product.id))
    .returning();

  return serializeListing(updated[0]!, vendor, platform);
}

function serializeListing(
  row: typeof products.$inferSelect,
  vendor: typeof vendors.$inferSelect,
  platform: PlatformCommerceSettings,
  env?: WorkerEnv,
) {
  const tier = row.deliveryTier as DeliveryTier;
  return {
    vendorCode: vendor.code,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unitPrice: row.unitPrice,
    salesPerUnit: row.salesPerUnit,
    vendorPayablePerUnit: row.vendorPayablePerUnit,
    patronagePerUnit: row.patronagePerUnit,
    listingFeePercent: row.listingFeePercent,
    deliveryPerItem: row.deliveryPerItem,
    deliveryTier: tier,
    effectiveDeliveryPerItem: effectiveDeliveryPerItem(
      platform,
      tier,
      vendor.deliveryPerItem,
      row.deliveryPerItem,
    ),
    patronageEligible: row.patronageEligible,
    currency: row.currency,
    imageUrl: env ? resolvePublicImageUrl(env, row.imageUrl) : row.imageUrl ?? null,
    listingStatus: row.listingStatus,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}
