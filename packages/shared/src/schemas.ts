import { z } from "zod";
import {
  MAX_PRODUCT_COPY_WORDS,
  MAX_PRODUCT_GALLERY_IMAGES,
  productCopyWordLimitError,
  totalProductCopyWords,
} from "./product-copy";

export const productCopyFieldSchema = z.string().max(8000).nullable().optional();

export const productCopyFieldsBaseSchema = z.object({
  shortDescription: productCopyFieldSchema,
  highlights: productCopyFieldSchema,
  features: productCopyFieldSchema,
});

function refineProductCopyWordLimit<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const total = totalProductCopyWords(data as ProductCopyFieldsInput);
    if (total > MAX_PRODUCT_COPY_WORDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: productCopyWordLimitError(total),
        path: ["shortDescription"],
      });
    }
  });
}

type ProductCopyFieldsInput = z.infer<typeof productCopyFieldsBaseSchema>;

export const productCopyFieldsSchema = refineProductCopyWordLimit(productCopyFieldsBaseSchema);

export type ProductCopyFields = z.infer<typeof productCopyFieldsSchema>;

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
  /** Approved storefront business name for "Sold by" and search. */
  vendorName: z.string().optional(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  unitPrice: z.string(),
  patronagePerUnit: z.string(),
  currency: z.string(),
  imageUrl: z.string().url().nullable().optional(),
  imageUrls: z.array(z.string().url()).max(MAX_PRODUCT_GALLERY_IMAGES).optional(),
  shortDescription: z.string().nullable().optional(),
  highlights: z.string().nullable().optional(),
  features: z.string().nullable().optional(),
});

export type CatalogItemPublic = z.infer<typeof catalogItemPublicSchema>;

/** Order lifecycle — delivery, pickup, or PayMongo online. */
export const orderStatusSchema = z.enum([
  "PENDING_DELIVERY",
  "PENDING_PICKUP",
  "PENDING_PAYMENT",
  "PAID",
  "POSTED_TO_LEDGER",
  "FAILED",
  "CANCELLED",
]);

export const paymentMethodSchema = z.enum(["pickup", "online"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const fulfillmentModeSchema = z.enum(["delivery", "merchant_pickup"]);
export type FulfillmentMode = z.infer<typeof fulfillmentModeSchema>;

export const fulfillmentStatusSchema = z.enum(["pending", "packed", "out_for_delivery", "delivered"]);
export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;

export const updateOrderFulfillmentSchema = z.object({
  status: fulfillmentStatusSchema,
});

export type UpdateOrderFulfillmentRequest = z.infer<typeof updateOrderFulfillmentSchema>;

export const pendingOrderSummarySchema = z.object({
  orderId: z.string().uuid(),
  externalId: z.string(),
  guestEmail: z.string().nullable(),
  vendorCode: z.string(),
  status: orderStatusSchema,
  fulfillmentMode: fulfillmentModeSchema,
  fulfillmentStatus: fulfillmentStatusSchema,
  grossAmount: z.string(),
  deliveryFeeAmount: z.string(),
  totalAmount: z.string(),
  createdAt: z.string(),
  deliveryCity: z.string().nullable().optional(),
  deliveryPhone: z.string().nullable().optional(),
});

export type PendingOrderSummary = z.infer<typeof pendingOrderSummarySchema>;

export const deliveryAddressSchema = z.object({
  recipientName: z.string().min(2).max(255),
  phone: z.string().min(7).max(32),
  line1: z.string().min(5).max(512),
  line2: z.string().max(255).optional(),
  barangay: z.string().max(128).optional(),
  city: z.string().min(2).max(128),
  province: z.string().max(128).optional(),
  postalCode: z.string().max(16).optional(),
  notes: z.string().max(500).optional(),
});

export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;

export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const patronageAccrualStatusSchema = z.enum(["ACCRUED", "MERGED", "PAID_OUT"]);

export type PatronageAccrualStatus = z.infer<typeof patronageAccrualStatusSchema>;

export const STORE_SERVICE_NAME = "b2ccoop-store-api";

export const checkoutItemSchema = z.object({
  sku: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutQuoteRequestSchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(50),
});

export type CheckoutQuoteRequest = z.infer<typeof checkoutQuoteRequestSchema>;

export const checkoutQuoteLineSchema = z.object({
  sku: z.string(),
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.string(),
  deliveryPerItem: z.string(),
  lineDeliveryFee: z.string(),
});

export const checkoutQuoteResponseSchema = z.object({
  ok: z.literal(true),
  vendorCode: z.string(),
  lines: z.array(checkoutQuoteLineSchema),
  merchandiseSubtotal: z.string(),
  deliverySubtotal: z.string(),
  deliveryFee: z.string(),
  deliveryCapApplied: z.boolean(),
  totalAmount: z.string(),
  pickupAvailable: z.boolean(),
  pickup: z
    .object({
      address: z.string(),
      landmark: z.string().nullable(),
      hours: z.string().nullable(),
      phone: z.string().nullable(),
      instructions: z.string().nullable(),
    })
    .nullable(),
});

export type CheckoutQuoteResponse = z.infer<typeof checkoutQuoteResponseSchema>;

export const checkoutRequestSchema = z
  .object({
    email: z.string().email().max(255),
    displayName: z.string().min(1).max(255).optional(),
    items: z.array(checkoutItemSchema).min(1).max(50),
    /** Pay on fulfillment (COD) or PayMongo online. */
    paymentMethod: paymentMethodSchema.default("pickup"),
    fulfillmentMode: fulfillmentModeSchema.default("delivery"),
    deliveryAddress: deliveryAddressSchema.optional(),
    turnstileToken: z.string().min(1).max(2048).optional(),
    firebaseIdToken: z.string().min(1).max(8192).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentMode === "delivery" && !data.deliveryAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delivery address is required for delivery orders",
        path: ["deliveryAddress"],
      });
    }
  });

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const checkoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  externalId: z.string(),
  status: orderStatusSchema,
  fulfillmentMode: fulfillmentModeSchema,
  grossAmount: z.string(),
  deliveryFeeAmount: z.string(),
  totalAmount: z.string(),
  patronageAmount: z.string(),
  currency: z.string(),
  fulfillmentNote: z.string().optional(),
  pickupNote: z.string().optional(),
  checkoutUrl: z.string().url().optional(),
});

export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export const orderDetailSchema = z.object({
  orderId: z.string().uuid(),
  externalId: z.string(),
  status: orderStatusSchema,
  fulfillmentMode: fulfillmentModeSchema,
  fulfillmentStatus: fulfillmentStatusSchema,
  guestEmail: z.string().nullable(),
  participantId: z.string().uuid().nullable(),
  vendorCode: z.string(),
  grossAmount: z.string(),
  deliveryFeeAmount: z.string(),
  totalAmount: z.string(),
  patronageAmount: z.string(),
  currency: z.string(),
  memo: z.string().nullable(),
  deliveryAddress: deliveryAddressSchema.nullable().optional(),
  accountingError: z.string().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  paidOnline: z.boolean().optional(),
  createdAt: z.string(),
  lines: z.array(
    z.object({
      sku: z.string(),
      productName: z.string(),
      quantity: z.number(),
      unitPrice: z.string(),
      lineGross: z.string(),
      linePatronage: z.string(),
      lineDeliveryFee: z.string(),
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
  turnstileToken: z.string().min(1).max(2048).optional(),
  /** When set, applicant email must match the verified Firebase account. */
  firebaseIdToken: z.string().min(1).max(8192).optional(),
});

export type SellerApplicationRequest = z.infer<typeof sellerApplicationRequestSchema>;

export const sellerApplicationStatusRequestSchema = z.object({
  email: z.string().email().max(255).optional(),
  statusToken: z.string().min(1).max(128).optional(),
  firebaseIdToken: z.string().min(1).max(8192).optional(),
  turnstileToken: z.string().min(1).max(2048).optional(),
});

export type SellerApplicationStatusRequest = z.infer<typeof sellerApplicationStatusRequestSchema>;

export const merchantBindFirebaseRequestSchema = z.object({
  firebaseIdToken: z.string().min(1).max(8192),
});

export type MerchantBindFirebaseRequest = z.infer<typeof merchantBindFirebaseRequestSchema>;

export const listingStatusSchema = z.enum(["DRAFT", "PENDING_REVIEW", "ACTIVE", "REJECTED"]);
export type ListingStatus = z.infer<typeof listingStatusSchema>;

export const sellerKindSchema = z.enum(["COOP", "MEMBER", "PARTNER"]);
export type SellerKind = z.infer<typeof sellerKindSchema>;

export const deliveryTierSchema = z.enum(["standard", "bulky", "remote"]);
export type DeliveryTier = z.infer<typeof deliveryTierSchema>;

const moneyStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
const percentStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);

export const platformCommerceSettingsSchema = z.object({
  defaultDeliveryPerItem: moneyStringSchema,
  maxDeliveryPerOrder: moneyStringSchema,
  defaultPartnerListingFeePercent: percentStringSchema,
  patronageRatePercent: percentStringSchema,
});

export type PlatformCommerceSettings = z.infer<typeof platformCommerceSettingsSchema>;

export const updatePlatformSettingsSchema = platformCommerceSettingsSchema.partial();
export type UpdatePlatformSettingsRequest = z.infer<typeof updatePlatformSettingsSchema>;

export const createListingRequestSchema = refineProductCopyWordLimit(
  productCopyFieldsBaseSchema.extend({
    /** Optional prefix; server appends a UTC timestamp for uniqueness. */
    sku: z.string().min(1).max(48).optional(),
    name: z.string().min(2).max(255),
    category: z.string().min(1).max(128),
    /** Suggested retail price (SRP) in PHP. */
    unitPrice: moneyStringSchema,
    /** Partner listing fee % of SRP; ignored for coop/member sellers. */
    listingFeePercent: percentStringSchema.optional(),
    deliveryTier: deliveryTierSchema.default("standard"),
    /** Product-level delivery override per item (PHP). */
    deliveryPerItem: moneyStringSchema.optional(),
    patronageEligible: z.boolean().default(true),
    submitForReview: z.boolean().default(true),
  }),
);

export type CreateListingRequest = z.infer<typeof createListingRequestSchema>;

export const updateListingRequestSchema = refineProductCopyWordLimit(
  productCopyFieldsBaseSchema.extend({
    name: z.string().min(2).max(255).optional(),
    category: z.string().min(1).max(128).optional(),
    unitPrice: moneyStringSchema.optional(),
    listingFeePercent: percentStringSchema.nullable().optional(),
    deliveryTier: deliveryTierSchema.optional(),
    deliveryPerItem: moneyStringSchema.nullable().optional(),
    patronageEligible: z.boolean().optional(),
    /** New SKU prefix — server assigns a fresh timestamp suffix. */
    skuBase: z.string().min(1).max(48).optional(),
    submitForReview: z.boolean().optional(),
  }),
).refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });

export type UpdateListingRequest = z.infer<typeof updateListingRequestSchema>;

export const adminApproveListingSchema = z.object({
  listingFeePercent: percentStringSchema.optional(),
  deliveryPerItem: moneyStringSchema.nullable().optional(),
  deliveryTier: deliveryTierSchema.optional(),
});

export type AdminApproveListingRequest = z.infer<typeof adminApproveListingSchema>;

export const merchantListingSchema = z.object({
  vendorCode: z.string(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  unitPrice: z.string(),
  salesPerUnit: z.string(),
  vendorPayablePerUnit: z.string(),
  patronagePerUnit: z.string(),
  listingFeePercent: z.string().nullable().optional(),
  deliveryPerItem: z.string().nullable().optional(),
  deliveryTier: deliveryTierSchema,
  effectiveDeliveryPerItem: z.string().optional(),
  patronageEligible: z.boolean(),
  currency: z.string(),
  imageUrl: z.string().url().nullable().optional(),
  imageUrls: z.array(z.string().url()).max(MAX_PRODUCT_GALLERY_IMAGES).optional(),
  shortDescription: z.string().nullable().optional(),
  highlights: z.string().nullable().optional(),
  features: z.string().nullable().optional(),
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

export const merchantBusinessTypeSchema = z.enum(["product", "service", "farm", "food"]);
export type MerchantBusinessType = z.infer<typeof merchantBusinessTypeSchema>;

export const merchantProfileSchema = z.object({
  code: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  email: z.string().nullable(),
  ownerEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  businessType: merchantBusinessTypeSchema,
  sellerKind: sellerKindSchema,
  pickupEnabled: z.boolean(),
  pickupAddress: z.string().nullable(),
  pickupLandmark: z.string().nullable(),
  pickupHours: z.string().nullable(),
  pickupInstructions: z.string().nullable(),
  pickupPhone: z.string().nullable(),
  deliveryPerItem: z.string().nullable(),
  partnerListingFeePercent: z.string().nullable(),
  pendingName: z.string().nullable(),
  pendingSlug: z.string().nullable(),
});

export type MerchantProfile = z.infer<typeof merchantProfileSchema>;

export const updateMerchantProfileSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  email: z.string().email().max(255).optional(),
  contactPhone: z.string().min(7).max(32).nullable().optional(),
  businessType: merchantBusinessTypeSchema.optional(),
  pickupEnabled: z.boolean().optional(),
  pickupAddress: z.string().max(512).nullable().optional(),
  pickupLandmark: z.string().max(255).nullable().optional(),
  pickupHours: z.string().max(255).nullable().optional(),
  pickupInstructions: z.string().max(2000).nullable().optional(),
  pickupPhone: z.string().max(32).nullable().optional(),
  deliveryPerItem: moneyStringSchema.nullable().optional(),
  partnerListingFeePercent: percentStringSchema.nullable().optional(),
});

export type UpdateMerchantProfileRequest = z.infer<typeof updateMerchantProfileSchema>;

export const adminUpdateVendorCommerceSchema = z.object({
  sellerKind: sellerKindSchema.optional(),
  deliveryPerItem: moneyStringSchema.nullable().optional(),
  partnerListingFeePercent: percentStringSchema.nullable().optional(),
});

export type AdminUpdateVendorCommerceRequest = z.infer<typeof adminUpdateVendorCommerceSchema>;
