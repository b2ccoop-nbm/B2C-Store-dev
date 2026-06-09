import { Hono } from "hono";
import { STORE_SERVICE_NAME } from "@b2ccoop/store-shared";
import { pingDatabase } from "./db/client";
import { corsOrigins, resolveDatabaseUrl, type WorkerEnv } from "./env";
import { corsMiddleware, securityHeaders } from "./middleware/security";

const app = new Hono<{ Bindings: WorkerEnv }>();

app.use("*", securityHeaders());
app.use("*", async (c, next) => {
  const middleware = corsMiddleware(corsOrigins(c.env), c.env.ENVIRONMENT ?? "development");
  return middleware(c, next);
});

app.get("/", (c) =>
  c.json({
    service: STORE_SERVICE_NAME,
    docs: "GET /health",
    phase: "0",
  }),
);

app.get("/health", async (c) => {
  const environment = c.env.ENVIRONMENT ?? "development";
  const dbUrl = resolveDatabaseUrl(c.env);
  let database: "ok" | "error" | "skipped" = "skipped";

  if (dbUrl) {
    database = (await pingDatabase(dbUrl)) ? "ok" : "error";
  }

  const ok = database !== "error";
  const body = {
    ok,
    service: STORE_SERVICE_NAME,
    environment,
    database,
    timestamp: new Date().toISOString(),
  };

  return c.json(body, ok ? 200 : 503);
});

export default app;
