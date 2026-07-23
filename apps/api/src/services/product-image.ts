import { and, eq } from "drizzle-orm";
import { MAX_PRODUCT_GALLERY_IMAGES } from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { products } from "../db/schema";
import type { WorkerEnv } from "../env";
import {
  normalizeProductImageUrls,
  primaryProductImageUrl,
  productImagePathSegment,
  slotImageKey,
} from "../lib/product-images";
import { resolvePublicImagesBaseUrl } from "../lib/product-image-url";
import { getVendorByCode } from "./vendors";

export class ProductImageError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 503 = 400,
  ) {
    super(message);
    this.name = "ProductImageError";
  }
}

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function parseSlot(raw: string | undefined): number {
  const slot = raw == null || raw === "" ? 0 : Number(raw);
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_PRODUCT_GALLERY_IMAGES) {
    throw new ProductImageError(`Image slot must be 0–${MAX_PRODUCT_GALLERY_IMAGES - 1}`);
  }
  return slot;
}

async function getProductRow(db: StoreDatabase, vendorId: string, sku: string) {
  const normalizedSku = sku.trim().toUpperCase().replace(/\s+/g, "-");
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.vendorId, vendorId), eq(products.sku, normalizedSku)))
    .limit(1);
  if (!rows[0]) {
    throw new ProductImageError("Listing not found — create the listing before uploading a photo", 404);
  }
  return rows[0];
}

export function galleryFromRow(row: {
  imageUrls: unknown;
  imageUrl: string | null;
}): string[] {
  return normalizeProductImageUrls(row.imageUrls, row.imageUrl);
}

async function persistGallery(db: StoreDatabase, productId: string, urls: string[]): Promise<string[]> {
  const trimmed = urls.slice(0, MAX_PRODUCT_GALLERY_IMAGES);
  await db
    .update(products)
    .set({
      imageUrls: trimmed,
      imageUrl: primaryProductImageUrl(trimmed),
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));
  return trimmed;
}

export async function uploadProductImage(
  env: WorkerEnv,
  db: StoreDatabase,
  vendorCode: string,
  sku: string,
  file: File,
  slotInput?: string,
): Promise<{ imageUrl: string; imageUrls: string[]; slot: number }> {
  return uploadProductImageAtSlot(env, db, vendorCode, sku, parseSlot(slotInput), file);
}

export async function uploadProductImageAtSlot(
  env: WorkerEnv,
  db: StoreDatabase,
  vendorCode: string,
  sku: string,
  slot: number,
  file: File,
): Promise<{ imageUrl: string; imageUrls: string[]; slot: number }> {
  if (!env.PRODUCT_IMAGES) {
    throw new ProductImageError("Image storage is not configured on the API", 503);
  }
  const base = resolvePublicImagesBaseUrl(env);
  if (!base) {
    throw new ProductImageError("PUBLIC_IMAGES_BASE_URL is not configured on the API", 503);
  }

  const mime = file.type?.toLowerCase() ?? "";
  const ext = ALLOWED_MIME.get(mime);
  if (!ext) {
    throw new ProductImageError("Use a JPEG, PNG, or WebP image");
  }
  if (file.size <= 0) {
    throw new ProductImageError("Image file is empty");
  }
  if (file.size > MAX_BYTES) {
    throw new ProductImageError("Image must be 2 MB or smaller");
  }

  const vendor = await getVendorByCode(db, vendorCode);
  if (!vendor) {
    throw new ProductImageError("Vendor not found", 404);
  }

  const product = await getProductRow(db, vendor.id, sku);
  const gallery = galleryFromRow(product);

  if (slot > gallery.length) {
    throw new ProductImageError(`Upload slot ${slot} is out of range — fill earlier slots first`);
  }
  if (gallery.length >= MAX_PRODUCT_GALLERY_IMAGES && slot >= MAX_PRODUCT_GALLERY_IMAGES) {
    throw new ProductImageError(`Maximum ${MAX_PRODUCT_GALLERY_IMAGES} product photos allowed`);
  }

  const key = slotImageKey(vendor.code, product.sku, slot, ext);
  const bytes = await file.arrayBuffer();
  await env.PRODUCT_IMAGES.put(key, bytes, {
    httpMetadata: { contentType: mime },
  });

  const publicUrl = `${base.replace(/\/$/, "")}/${key}`;
  if (slot < gallery.length) {
    gallery[slot] = publicUrl;
  } else {
    gallery.push(publicUrl);
  }

  const saved = await persistGallery(db, product.id, gallery);
  return {
    imageUrl: saved[0] ?? publicUrl,
    imageUrls: saved,
    slot,
  };
}

export async function deleteProductImageAtSlot(
  env: WorkerEnv,
  db: StoreDatabase,
  vendorCode: string,
  sku: string,
  slotInput: string,
): Promise<{ imageUrls: string[] }> {
  const slot = parseSlot(slotInput);
  const vendor = await getVendorByCode(db, vendorCode);
  if (!vendor) {
    throw new ProductImageError("Vendor not found", 404);
  }

  const product = await getProductRow(db, vendor.id, sku);
  const gallery = galleryFromRow(product);
  if (slot >= gallery.length) {
    throw new ProductImageError("No image at that slot", 404);
  }

  const base = resolvePublicImagesBaseUrl(env);
  const url = gallery[slot];
  if (env.PRODUCT_IMAGES && base && url?.startsWith(`${base.replace(/\/$/, "")}/`)) {
    const key = url.slice(base.replace(/\/$/, "").length + 1);
    await env.PRODUCT_IMAGES.delete(key).catch(() => {});
  }

  gallery.splice(slot, 1);
  const saved = await persistGallery(db, product.id, gallery);
  return { imageUrls: saved };
}

export async function migrateProductGalleryForSkuChange(
  env: WorkerEnv,
  vendorCode: string,
  oldSku: string,
  newSku: string,
  imageUrls: string[],
): Promise<string[]> {
  if (!env.PRODUCT_IMAGES) return imageUrls;

  const base = resolvePublicImagesBaseUrl(env);
  if (!base) return imageUrls;

  const migrated: string[] = [];
  for (let slot = 0; slot < imageUrls.length; slot += 1) {
    const url = imageUrls[slot]!;
    const ext = url.split(".").pop()?.toLowerCase();
    if (!ext || !["jpg", "jpeg", "png", "webp"].includes(ext)) {
      migrated.push(url);
      continue;
    }
    const normalizedExt = ext === "jpeg" ? "jpg" : ext;
    const oldKey = slotImageKey(vendorCode, oldSku, slot, normalizedExt);
    const newKey = slotImageKey(vendorCode, newSku, slot, normalizedExt);
    const object = await env.PRODUCT_IMAGES.get(oldKey);
    if (!object) {
      migrated.push(url);
      continue;
    }
    await env.PRODUCT_IMAGES.put(newKey, object.body, { httpMetadata: object.httpMetadata });
    migrated.push(`${base.replace(/\/$/, "")}/${newKey}`);
  }
  return migrated.slice(0, MAX_PRODUCT_GALLERY_IMAGES);
}

/** @deprecated Use migrateProductGalleryForSkuChange */
export async function migrateProductImageForSkuChange(
  env: WorkerEnv,
  vendorCode: string,
  oldSku: string,
  newSku: string,
  imageUrl: string,
): Promise<string | null> {
  const next = await migrateProductGalleryForSkuChange(env, vendorCode, oldSku, newSku, [imageUrl]);
  return next[0] ?? null;
}
