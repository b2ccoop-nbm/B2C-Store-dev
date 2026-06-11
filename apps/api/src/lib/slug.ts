/** URL-safe slug from display name or vendor code. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

/** Vendor code from business name, e.g. "Maria's Bakery" → B2C-MARIAS-BAKERY */
export function vendorCodeFromName(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.startsWith("B2C-") ? base : `B2C-${base}`;
}
