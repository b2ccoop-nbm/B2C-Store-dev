import type { Context } from "hono";
import type { WorkerEnv } from "../env";

const ALLOWED_PREFIX = "products/";

export async function getProductMedia(c: Context<{ Bindings: WorkerEnv }>) {
  const bucket = c.env.PRODUCT_IMAGES;
  if (!bucket) {
    return c.json({ error: "Image storage is not configured" }, 503);
  }

  const key = c.req.path.replace(/^\/media\/?/, "");
  if (!key || !key.startsWith(ALLOWED_PREFIX) || key.includes("..")) {
    return c.json({ error: "Not found" }, 404);
  }

  const object = await bucket.get(key);
  if (!object) {
    return c.json({ error: "Not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }
  headers.set("Cache-Control", "public, max-age=86400, immutable");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");

  return new Response(object.body, { headers });
}
