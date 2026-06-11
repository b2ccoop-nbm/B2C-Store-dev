import type { CatalogItemPublic } from "@b2ccoop/store-shared";

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

export function filterCatalog(items: CatalogItemPublic[], query: string): CatalogItemPublic[] {
  const q = normalizeQuery(query);
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [item.name, item.sku, item.category, item.vendorCode].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

export function filterByCategorySlug(items: CatalogItemPublic[], slug: string): CatalogItemPublic[] {
  const s = slug.trim().toLowerCase();
  if (!s || s === "all" || s === "products") return items;
  return items.filter((item) => item.category.toLowerCase().replace(/\s+/g, "-") === s);
}
