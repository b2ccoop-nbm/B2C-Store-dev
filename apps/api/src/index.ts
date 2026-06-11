import { Hono } from "hono";
import { STORE_SERVICE_NAME } from "@b2ccoop/store-shared";
import { pingDatabase } from "./db/client";
import { corsOrigins, resolveDatabaseUrl, type WorkerEnv } from "./env";
import {
  getAdminPendingApplications,
  getAdminPendingListings,
  patchApproveApplication,
  patchApproveListing,
  patchRejectApplication,
} from "./routes/admin-merchants";
import {
  adminAuth,
  getAdminPendingOrders,
  patchConfirmPickup,
} from "./routes/admin-orders";
import {
  getMerchantListings,
  getMerchantPendingOrders,
  merchantAuth,
  merchantVendorScope,
  postMerchantListing,
} from "./routes/merchant";
import { getCatalog } from "./routes/catalog";
import {
  getSellerApplicationStatus,
  postSellerApplication,
} from "./routes/seller-applications";
import { getStorefront } from "./routes/storefront";
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
      "GET /storefront/:slug",
      "POST /checkout",
      "GET /orders/:id",
      "POST /seller/applications",
      "GET /seller/applications",
      "GET /merchant/listings",
      "POST /merchant/listings",
      "GET /merchant/orders/pending",
      "GET /admin/orders/pending",
      "PATCH /admin/orders/:id/confirm-pickup",
      "GET /admin/seller-applications",
      "GET /admin/listings/pending",
      "PATCH /admin/seller-applications/:id/approve",
      "PATCH /admin/seller-applications/:id/reject",
      "PATCH /admin/listings/:vendorCode/:sku/approve",
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
app.get("/storefront/:slug", (c) => getStorefront(c));
app.post("/checkout", (c) => postCheckout(c));
app.get("/orders/:id", (c) => getOrder(c));

app.post("/seller/applications", (c) => postSellerApplication(c));
app.get("/seller/applications", (c) => getSellerApplicationStatus(c));

const merchant = new Hono<{ Bindings: WorkerEnv }>();
merchant.use("*", merchantAuth);
merchant.use("*", merchantVendorScope);
merchant.get("/listings", (c) => getMerchantListings(c));
merchant.post("/listings", (c) => postMerchantListing(c));
merchant.get("/orders/pending", (c) => getMerchantPendingOrders(c));
app.route("/merchant", merchant);

const admin = new Hono<{ Bindings: WorkerEnv }>();
admin.use("*", adminAuth);
admin.get("/orders/pending", (c) => getAdminPendingOrders(c));
admin.patch("/orders/:id/confirm-pickup", (c) => patchConfirmPickup(c));
admin.get("/seller-applications", (c) => getAdminPendingApplications(c));
admin.get("/listings/pending", (c) => getAdminPendingListings(c));
admin.patch("/seller-applications/:id/approve", (c) => patchApproveApplication(c));
admin.patch("/seller-applications/:id/reject", (c) => patchRejectApplication(c));
admin.patch("/listings/:vendorCode/:sku/approve", (c) => patchApproveListing(c));
app.route("/admin", admin);

app.get("/dev/fixtures", (c) => getDevFixtures(c));
app.post("/webhooks/paymongo", (c) => postPaymongoWebhook(c));

export default app;
