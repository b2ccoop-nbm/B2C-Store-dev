import { Hono } from "hono";
import { STORE_SERVICE_NAME } from "@b2ccoop/store-shared";
import { pingDatabase } from "./db/client";
import { corsOrigins, resolveDatabaseUrl, type WorkerEnv } from "./env";
import {
  adminAuth,
  getAdminPendingOrders,
  patchConfirmPickup,
} from "./routes/admin-orders";
import { getCatalog } from "./routes/catalog";
import { postCheckout } from "./routes/checkout";
import { getDevFixtures } from "./routes/dev-fixtures";
import { getOrder } from "./routes/orders";
import { postPaymongoWebhook } from "./routes/webhooks-paymongo";
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
    routes: [
      "GET /health",
      "GET /catalog",
      "POST /checkout",
      "GET /orders/:id",
      "GET /admin/orders/pending",
      "PATCH /admin/orders/:id/confirm-pickup",
      "GET /dev/fixtures",
      "POST /webhooks/paymongo",
    ],
    phase: "2",
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

app.get("/catalog", (c) => getCatalog(c));
app.post("/checkout", (c) => postCheckout(c));
app.get("/orders/:id", (c) => getOrder(c));

const admin = new Hono<{ Bindings: WorkerEnv }>();
admin.use("*", adminAuth);
admin.get("/orders/pending", (c) => getAdminPendingOrders(c));
admin.patch("/orders/:id/confirm-pickup", (c) => patchConfirmPickup(c));
app.route("/admin", admin);

app.get("/dev/fixtures", (c) => getDevFixtures(c));
app.post("/webhooks/paymongo", (c) => postPaymongoWebhook(c));

export default app;
