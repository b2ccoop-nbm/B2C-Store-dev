import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING_PICKUP",
  "PENDING_PAYMENT",
  "PAID",
  "POSTED_TO_LEDGER",
  "FAILED",
  "CANCELLED",
]);

export const patronageAccrualStatusEnum = pgEnum("patronage_accrual_status", [
  "ACCRUED",
  "MERGED",
  "PAID_OUT",
]);

export const sellerApplicationStatusEnum = pgEnum("seller_application_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const listingStatusEnum = pgEnum("listing_status", [
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "REJECTED",
]);

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  ownerEmail: varchar("owner_email", { length: 255 }),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sellerApplications = pgTable("seller_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicantEmail: varchar("applicant_email", { length: 255 }).notNull(),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  businessType: varchar("business_type", { length: 64 }).notNull().default("product"),
  contactPhone: varchar("contact_phone", { length: 32 }),
  description: text("description"),
  proposedVendorCode: varchar("proposed_vendor_code", { length: 64 }),
  status: sellerApplicationStatusEnum("status").notNull().default("PENDING"),
  vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 128 }).notNull().default("General"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    salesPerUnit: numeric("sales_per_unit", { precision: 14, scale: 2 }).notNull(),
    vendorPayablePerUnit: numeric("vendor_payable_per_unit", { precision: 14, scale: 2 }).notNull(),
    cogsPerUnit: numeric("cogs_per_unit", { precision: 14, scale: 2 }).notNull().default("0"),
    patronagePerUnit: numeric("patronage_per_unit", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("PHP"),
    listingStatus: listingStatusEnum("listing_status").notNull().default("ACTIVE"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("products_vendor_sku_idx").on(table.vendorId, table.sku)],
);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Idempotency key for accounting, e.g. order:<uuid> */
  externalId: varchar("external_id", { length: 128 }).notNull().unique(),
  guestEmail: varchar("guest_email", { length: 255 }),
  participantId: uuid("participant_id"),
  vendorCode: varchar("vendor_code", { length: 64 }).notNull(),
  status: orderStatusEnum("status").notNull().default("PENDING_PICKUP"),
  grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }).notNull(),
  salesAmount: numeric("sales_amount", { precision: 14, scale: 2 }).notNull(),
  vendorPayableAmount: numeric("vendor_payable_amount", { precision: 14, scale: 2 }).notNull(),
  cogsAmount: numeric("cogs_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  patronageAmount: numeric("patronage_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 3 }).notNull().default("PHP"),
  memo: text("memo"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderLines = pgTable("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  sku: varchar("sku", { length: 64 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  lineGross: numeric("line_gross", { precision: 14, scale: 2 }).notNull(),
  linePatronage: numeric("line_patronage", { precision: 14, scale: 2 }).notNull().default("0"),
});

export const patronageAccruals = pgTable("patronage_accruals", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailNormalized: varchar("email_normalized", { length: 255 }).notNull(),
  participantId: uuid("participant_id"),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  status: patronageAccrualStatusEnum("status").notNull().default("ACCRUED"),
  linkedAt: timestamp("linked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Vendor = typeof vendors.$inferSelect;
export type SellerApplication = typeof sellerApplications.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderLine = typeof orderLines.$inferSelect;
export type PatronageAccrual = typeof patronageAccruals.$inferSelect;
