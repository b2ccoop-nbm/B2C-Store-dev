import type { WorkerEnv } from "../env";
import { resolvePublicImageUrl } from "./product-image-url";
import { galleryFromRow } from "../services/product-image";

type CatalogProductRow = {
  vendorCode: string;
  vendorSlug: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: string;
  patronagePerUnit: string;
  currency: string;
  imageUrl: string | null;
  imageUrls: unknown;
  shortDescription: string | null;
  highlights: string | null;
  features: string | null;
};

export function serializeCatalogItem(env: WorkerEnv, row: CatalogProductRow) {
  const gallery = galleryFromRow({ imageUrls: row.imageUrls, imageUrl: row.imageUrl });
  const imageUrls = gallery
    .map((url) => resolvePublicImageUrl(env, url))
    .filter((url): url is string => Boolean(url));

  return {
    vendorCode: row.vendorCode,
    vendorSlug: row.vendorSlug,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unitPrice: row.unitPrice,
    patronagePerUnit: row.patronagePerUnit,
    currency: row.currency,
    imageUrl: imageUrls[0] ?? resolvePublicImageUrl(env, row.imageUrl),
    imageUrls,
    shortDescription: row.shortDescription ?? null,
    highlights: row.highlights ?? null,
    features: row.features ?? null,
  };
}
