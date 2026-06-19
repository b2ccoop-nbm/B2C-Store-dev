import type { Context, Next } from "hono";

/** Vendor code is set by merchantAuth middleware from token or legacy header. */
export function requireMerchantVendor() {
  return async (c: Context, next: Next) => {
    const vendorCode = (c.get("vendorCode") as string | undefined)?.trim();
    if (!vendorCode) {
      return c.json({ error: "Vendor context missing" }, 401);
    }
    await next();
  };
}

export function getVendorCode(c: Context): string {
  return (c.get("vendorCode") as string | undefined) ?? "";
}
