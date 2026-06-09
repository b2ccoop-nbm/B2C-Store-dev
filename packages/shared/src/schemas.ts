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
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  unitPrice: z.string(),
  patronagePerUnit: z.string(),
  currency: z.string(),
});

export type CatalogItemPublic = z.infer<typeof catalogItemPublicSchema>;

/** Order lifecycle — pay on pickup first, then PayMongo in Phase 2. */
export const orderStatusSchema = z.enum([
  "PENDING_PICKUP",
  "PAID",
  "POSTED_TO_LEDGER",
  "FAILED",
  "CANCELLED",
]);

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
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const checkoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  externalId: z.string(),
  status: orderStatusSchema,
  grossAmount: z.string(),
  patronageAmount: z.string(),
  currency: z.string(),
  pickupNote: z.string(),
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
