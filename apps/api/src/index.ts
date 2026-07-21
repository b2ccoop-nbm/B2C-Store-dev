import { Hono } from "hono";
import { STORE_SERVICE_NAME } from "@b2ccoop/store-shared";
import { pingDatabase } from "./db/client";
import { corsOrigins, resolveDatabaseUrl, type WorkerEnv } from "./env";
import {
  getAdminPendingApplications,
  getAdminPendingListings,
  getAdminPendingProfileChanges,
  getAdminVendors,
  patchApproveApplication,
  patchApproveListing,
  patchApproveVendorProfile,
  patchRejectApplication,
  patchRotateVendorToken,
} from "./routes/admin-merchants";
import {
  adminAuth,
  getAdminPendingOrders,
  patchConfirmPickup,
} from "./routes/admin-orders";
import { getAdminSession } from "./routes/admin-session";
import {
  getMerchantListings,
  getMerchantPendingOrders,
  getMerchantProfileRoute,
  getMerchantSession,
  merchantAuth,
  merchantVendorScope,
  patchMerchantConfirmPickup,
  patchMerchantProfileRoute,
  postMerchantListing,
  postMerchantListingImage,
} from "./routes/merchant";
import { getCatalog } from "./routes/catalog";
import { getMemberMerchantContext } from "./routes/member-merchant";
import {
  getSellerApplicationStatus,
  postMerchantBindFirebase,
  postSellerApplication,
  postSellerApplicationStatus,
} from "./routes/seller-applications";
import { getStorefront } from "./routes/storefront";
import { postCheckout } from "./routes/checkout";
import { getDevFixtures } from "./routes/dev-fixtures";
import { getMemberStorePatronage, getOrdersByEmail } from "./routes/member-activity";
import { getOrder } from "./routes/orders";
import { postPaymongoWebhook } from "./routes/webhooks-paymongo";
import { getProductMedia } from "./routes/product-media";
import { corsMiddleware, securityHeaders } from "./middleware/security";
import type { MerchantVariables } from "./middleware/vendor-auth";
import type { StoreAdminVariables } from "./middleware/store-admin-auth";

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
      "GET /orders?email=",
      "GET /members/store-patronage?email=",
      "POST /seller/applications",
      "POST /seller/applications/status",
      "GET /seller/applications",
      "POST /merchant/bind-firebase",
      "GET /members/merchant-context",
      "GET /merchant/session",
      "GET /merchant/profile",
      "PATCH /merchant/profile",
      "GET /merchant/listings",
      "POST /merchant/listings",
      "POST /merchant/listings/:sku/image",
      "GET /media/products/*",
      "GET /merchant/orders/pending",
      "PATCH /merchant/orders/:id/confirm-pickup",
      "GET /admin/session",
      "GET /admin/orders/pending",
      "PATCH /admin/orders/:id/confirm-pickup",
      "GET /admin/seller-applications",
      "GET /admin/vendors",
      "GET /admin/profile-changes/pending",
      "PATCH /admin/vendors/:code/approve-profile",
      "GET /admin/listings/pending",
      "PATCH /admin/seller-applications/:id/approve",
      "PATCH /admin/seller-applications/:id/reject",
      "PATCH /admin/listings/:vendorCode/:sku/approve",
      "PATCH /admin/vendors/:code/rotate-token",
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
app.get("/media/*", (c) => getProductMedia(c));
app.get("/storefront/:slug", (c) => getStorefront(c));
app.post("/checkout", (c) => postCheckout(c));
app.get("/orders", (c) => getOrdersByEmail(c));
app.get("/orders/:id", (c) => getOrder(c));
app.get("/members/store-patronage", (c) => getMemberStorePatronage(c));
app.get("/members/merchant-context", (c) => getMemberMerchantContext(c));

app.post("/seller/applications", (c) => postSellerApplication(c));
app.post("/seller/applications/status", (c) => postSellerApplicationStatus(c));
app.get("/seller/applications", (c) => getSellerApplicationStatus(c));
app.post("/merchant/bind-firebase", (c) => postMerchantBindFirebase(c));

const merchant = new Hono<{ Bindings: WorkerEnv; Variables: MerchantVariables }>();
merchant.use("*", merchantAuth());
merchant.use("*", merchantVendorScope);
merchant.get("/session", (c) => getMerchantSession(c));
merchant.get("/profile", (c) => getMerchantProfileRoute(c));
merchant.patch("/profile", (c) => patchMerchantProfileRoute(c));
merchant.get("/listings", (c) => getMerchantListings(c));
merchant.post("/listings", (c) => postMerchantListing(c));
merchant.post("/listings/:sku/image", (c) => postMerchantListingImage(c));
merchant.get("/orders/pending", (c) => getMerchantPendingOrders(c));
merchant.patch("/orders/:id/confirm-pickup", (c) => patchMerchantConfirmPickup(c));
app.route("/merchant", merchant);

const admin = new Hono<{ Bindings: WorkerEnv; Variables: StoreAdminVariables }>();
admin.use("*", adminAuth);
admin.get("/session", (c) => getAdminSession(c));
admin.get("/orders/pending", (c) => getAdminPendingOrders(c));
admin.patch("/orders/:id/confirm-pickup", (c) => patchConfirmPickup(c));
admin.get("/seller-applications", (c) => getAdminPendingApplications(c));
admin.get("/vendors", (c) => getAdminVendors(c));
admin.get("/profile-changes/pending", (c) => getAdminPendingProfileChanges(c));
admin.patch("/vendors/:code/approve-profile", (c) => patchApproveVendorProfile(c));
admin.get("/listings/pending", (c) => getAdminPendingListings(c));
admin.patch("/seller-applications/:id/approve", (c) => patchApproveApplication(c));
admin.patch("/seller-applications/:id/reject", (c) => patchRejectApplication(c));
admin.patch("/listings/:vendorCode/:sku/approve", (c) => patchApproveListing(c));
admin.patch("/vendors/:code/rotate-token", (c) => patchRotateVendorToken(c));
app.route("/admin", admin);

app.get("/dev/fixtures", (c) => getDevFixtures(c));
app.post("/webhooks/paymongo", (c) => postPaymongoWebhook(c));

export default app;
