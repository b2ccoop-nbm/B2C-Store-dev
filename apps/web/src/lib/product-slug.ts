export function productSlug(sku: string): string {
  return sku.toLowerCase();
}

export function skuFromSlug(slug: string): string {
  return slug.toUpperCase();
}
