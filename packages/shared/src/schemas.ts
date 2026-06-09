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
