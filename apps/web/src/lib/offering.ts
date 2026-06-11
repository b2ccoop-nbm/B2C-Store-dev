import type { CatalogItemPublic } from "@b2ccoop/store-shared";
import { productSlug } from "@/lib/product-slug";

export function categorySlug(category: string): string {
  return category.trim().toLowerCase().replace(/\s+/g, "-");
}

export function offeringHref(item: CatalogItemPublic): string {
  return `/offering/${productSlug(item.sku)}`;
}

export function cartPayloadFromItem(item: CatalogItemPublic): string {
  return JSON.stringify({
    sku: item.sku,
    name: item.name,
    unitPrice: item.unitPrice,
    patronagePerUnit: item.patronagePerUnit,
    vendorCode: item.vendorCode,
  });
}

export function patronagePerUnit(item: CatalogItemPublic): number {
  return Number(item.patronagePerUnit) || 0;
}

export function addToCartLabel(name: string): string {
  return `Add ${name} to cart`;
}

export function isCoopVendor(vendorCode: string): boolean {
  return vendorCode.startsWith("B2C-");
}
