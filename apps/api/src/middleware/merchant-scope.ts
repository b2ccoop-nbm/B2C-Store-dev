import type { Context, Next } from "hono";
import type { WorkerEnv } from "../env";

export function requireVendorCode() {
  return async (c: Context<{ Bindings: WorkerEnv }>, next: Next) => {
    const vendorCode = c.req.header("X-Vendor-Code")?.trim();
    if (!vendorCode) {
      return c.json({ error: "X-Vendor-Code header required" }, 400);
    }
    await next();
  };
}

export function getVendorCode(c: Context): string {
  return c.req.header("X-Vendor-Code")?.trim() ?? "";
}
