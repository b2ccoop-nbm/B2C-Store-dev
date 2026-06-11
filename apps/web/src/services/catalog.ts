import type { CatalogItemPublic } from "@b2ccoop/store-shared";
import { API_BASE } from "@/lib/api";

export type CatalogResponse = {
  storeMode?: string;
  currency: string;
  itemCount: number;
  items: CatalogItemPublic[];
  devAccounts?: {
    guestCheckout: string;
    members: string[];
    staff: string[];
  };
};

export async function fetchCatalog(apiBase = API_BASE): Promise<CatalogResponse> {
  const res = await fetch(`${apiBase}/catalog`);
  if (!res.ok) {
    throw new Error(`Catalog unavailable (${res.status})`);
  }
  return res.json() as Promise<CatalogResponse>;
}

export function groupByCategory(items: CatalogItemPublic[]): Record<string, CatalogItemPublic[]> {
  return items.reduce<Record<string, CatalogItemPublic[]>>((acc, item) => {
    const key = item.category || "General";
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function findProductBySlug(items: CatalogItemPublic[], slug: string): CatalogItemPublic | undefined {
  const normalized = slug.trim().toLowerCase();
  return items.find((item) => item.sku.toLowerCase() === normalized);
}

export function filterByCategorySlug(items: CatalogItemPublic[], categorySlug: string): CatalogItemPublic[] {
  const slug = categorySlug.trim().toLowerCase();
  if (slug === "products" || slug === "all") {
    return items;
  }
  return items.filter((item) => item.category.toLowerCase().replace(/\s+/g, "-") === slug);
}
