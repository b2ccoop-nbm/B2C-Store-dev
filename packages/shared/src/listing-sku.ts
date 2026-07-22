const TIMESTAMP_SUFFIX = /-\d{14}$/;

/** Normalize a SKU prefix/base: uppercase, hyphens, alphanumeric only. */
export function normalizeListingSkuBase(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
  return normalized.replace(TIMESTAMP_SUFFIX, "") || "ITEM";
}

/** Derive a readable SKU prefix from a product name. */
export function listingSkuBaseFromName(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "ITEM";
  return normalizeListingSkuBase(words.slice(0, 4).join("-")).slice(0, 32);
}

/** UTC timestamp suffix: YYYYMMDDHHmmss */
export function formatListingSkuTimestamp(at: Date = new Date()): string {
  const iso = at.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}`;
}

/** Build a unique listing SKU: `{base}-{YYYYMMDDHHmmss}` (max 64 chars). */
export function buildListingSku(base: string, at: Date = new Date()): string {
  const normalized = normalizeListingSkuBase(base);
  const stamp = formatListingSkuTimestamp(at);
  const maxBaseLen = 64 - stamp.length - 1;
  const trimmedBase = normalized.slice(0, Math.max(4, maxBaseLen));
  return `${trimmedBase}-${stamp}`;
}

export function stripListingSkuTimestamp(sku: string): string {
  return normalizeListingSkuBase(sku);
}
