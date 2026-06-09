import type { Context, Next } from "hono";

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
};

export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      c.header(key, value);
    }
  };
}

/** Phase 1: tighten to store.b2ccoop.com + localhost only. */
export function corsMiddleware(allowedOrigins: string[], environment = "development") {
  return async (c: Context, next: Next) => {
    const origin = c.req.header("Origin") ?? "";
    const allowed =
      allowedOrigins.includes(origin) ||
      (origin.startsWith("http://localhost:") && environment === "development");

    if (allowed && origin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Vary", "Origin");
    }

    if (c.req.method === "OPTIONS") {
      c.header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return c.body(null, 204);
    }

    await next();
  };
}
