import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  environment: z.string(),
  database: z.enum(["ok", "error", "skipped"]),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const catalogItemPublicSchema = z.object({
  vendorCode: z.string(),
  vendorSlug: z.string().optional(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  unitPrice: z.string(),
  patronagePerUnit: z.string(),
  currency: z.string(),
});

export type CatalogItemPublic = z.infer<typeof catalogItemPublicSchema>;

/** Order lifecycle — pay on pickup (MVP) or PayMongo online (Phase 2). */
export const orderStatusSchema = z.enum([
  "PENDING_PICKUP",
  "PENDING_PAYMENT",
  "PAID",
  "POSTED_TO_LEDGER",
  "FAILED",
  "CANCELLED",
]);

export const paymentMethodSchema = z.enum(["pickup", "online"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const patronageAccrualStatusSchema = z.enum(["ACCRUED", "MERGED", "PAID_OUT"]);

export type PatronageAccrualStatus = z.infer<typeof patronageAccrualStatusSchema>;

export const STORE_SERVICE_NAME = "b2ccoop-store-api";

export const checkoutItemSchema = z.object({
  sku: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutRequestSchema = z.object({
  email: z.string().email().max(255),
  displayName: z.string().min(1).max(255).optional(),
  items: z.array(checkoutItemSchema).min(1).max(50),
  /** Defaults to pay-on-pickup. `online` requires PayMongo keys on the API. */
  paymentMethod: paymentMethodSchema.default("pickup"),
  /** Cloudflare Turnstile — required when TURNSTILE_SECRET_KEY is set on the API. */
  turnstileToken: z.string().min(1).max(2048).optional(),
  /** Firebase ID token — optional member sign-in; email must match token. */
  firebaseIdToken: z.string().min(1).max(8192).optional(),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const checkoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  externalId: z.string(),
  status: orderStatusSchema,
  grossAmount: z.string(),
  patronageAmount: z.string(),
  currency: z.string(),
  pickupNote: z.string().optional(),
  /** Present when paymentMethod is `online` and PayMongo session was created. */
  checkoutUrl: z.string().url().optional(),
});

export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export const orderDetailSchema = z.object({
  orderId: z.string().uuid(),
  externalId: z.string(),
  status: orderStatusSchema,
  guestEmail: z.string().nullable(),
  participantId: z.string().uuid().nullable(),
  vendorCode: z.string(),
  grossAmount: z.string(),
  patronageAmount: z.string(),
  currency: z.string(),
  memo: z.string().nullable(),
  accountingError: z.string().optional(),
  createdAt: z.string(),
  lines: z.array(
    z.object({
      sku: z.string(),
      productName: z.string(),
      quantity: z.number(),
      unitPrice: z.string(),
      lineGross: z.string(),
      linePatronage: z.string(),
    }),
  ),
});

export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const sellerApplicationStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type SellerApplicationStatus = z.infer<typeof sellerApplicationStatusSchema>;

export const sellerApplicationRequestSchema = z.object({
  applicantEmail: z.string().email().max(255),
  businessName: z.string().min(2).max(255),
  businessType: z.enum(["product", "service", "farm", "food"]).default("product"),
  contactPhone: z.string().min(7).max(32).optional(),
  description: z.string().max(2000).optional(),
});

export type SellerApplicationRequest = z.infer<typeof sellerApplicationRequestSchema>;

export const listingStatusSchema = z.enum(["DRAFT", "PENDING_REVIEW", "ACTIVE", "REJECTED"]);
export type ListingStatus = z.infer<typeof listingStatusSchema>;

export const createListingRequestSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(2).max(255),
  category: z.string().min(1).max(128),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  patronagePerUnit: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  submitForReview: z.boolean().default(true),
});

export type CreateListingRequest = z.infer<typeof createListingRequestSchema>;

export const merchantListingSchema = z.object({
  vendorCode: z.string(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  unitPrice: z.string(),
  patronagePerUnit: z.string(),
  currency: z.string(),
  listingStatus: listingStatusSchema,
  isActive: z.boolean(),
  updatedAt: z.string(),
});

export type MerchantListing = z.infer<typeof merchantListingSchema>;

export const storefrontResponseSchema = z.object({
  slug: z.string(),
  vendorCode: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  listingCount: z.number(),
  currency: z.string(),
  items: z.array(catalogItemPublicSchema),
});

export type StorefrontResponse = z.infer<typeof storefrontResponseSchema>;
