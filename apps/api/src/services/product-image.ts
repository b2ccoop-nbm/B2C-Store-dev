import { and, eq } from "drizzle-orm";
import type { StoreDatabase } from "../db/client";
import { products, vendors } from "../db/schema";
import type { WorkerEnv } from "../env";
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

function pathSegment(value: string): string {
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!cleaned) {
    throw new ProductImageError("Invalid path segment");
  }
  return cleaned;
}

export async function uploadProductImage(
  env: WorkerEnv,
  db: StoreDatabase,
  vendorCode: string,
  sku: string,
  file: File,
): Promise<{ imageUrl: string }> {
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

  const normalizedSku = sku.trim().toUpperCase().replace(/\s+/g, "-");
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.vendorId, vendor.id), eq(products.sku, normalizedSku)))
    .limit(1);
  if (!rows[0]) {
    throw new ProductImageError("Listing not found — create the listing before uploading a photo", 404);
  }

  const key = `products/${pathSegment(vendor.code)}/${pathSegment(normalizedSku)}.${ext}`;
  const bytes = await file.arrayBuffer();
  await env.PRODUCT_IMAGES.put(key, bytes, {
    httpMetadata: { contentType: mime },
  });

  const imageUrl = `${base.replace(/\/$/, "")}/${key}`;
  await db
    .update(products)
    .set({ imageUrl, updatedAt: new Date() })
    .where(eq(products.id, rows[0].id));

  return { imageUrl };
}
