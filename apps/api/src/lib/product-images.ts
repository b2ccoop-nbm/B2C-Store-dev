import { MAX_PRODUCT_GALLERY_IMAGES } from "@b2ccoop/store-shared";

export function normalizeProductImageUrls(raw: unknown, legacyImageUrl?: string | null): string[] {
  const urls: string[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string" && entry.trim()) {
        urls.push(entry.trim());
      }
    }
  }
  if (urls.length === 0 && legacyImageUrl?.trim()) {
    urls.push(legacyImageUrl.trim());
  }
  return urls.slice(0, MAX_PRODUCT_GALLERY_IMAGES);
}

export function primaryProductImageUrl(urls: string[]): string | null {
  return urls[0] ?? null;
}

export function productImagePathSegment(value: string): string {
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!cleaned) {
    throw new Error("Invalid path segment");
  }
  return cleaned;
}

export function slotImageKey(vendorCode: string, sku: string, slot: number, ext: string): string {
  return `products/${productImagePathSegment(vendorCode)}/${productImagePathSegment(sku)}-${slot}.${ext}`;
}
