import type { Context, Next } from "hono";
import type { WorkerEnv } from "../env";

export function devAdminAuth() {
  return async (c: Context<{ Bindings: WorkerEnv }>, next: Next) => {
    const expected = c.env.DEV_ADMIN_SECRET?.trim();
    if (!expected) {
      return c.json({ error: "Admin API not configured (DEV_ADMIN_SECRET)" }, 503);
    }

    const header = c.req.header("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token || token !== expected) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
  };
}
