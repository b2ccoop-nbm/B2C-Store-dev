CREATE TYPE "public"."order_status" AS ENUM('PENDING_PICKUP', 'PAID', 'POSTED_TO_LEDGER', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."patronage_accrual_status" AS ENUM('ACCRUED', 'MERGED', 'PAID_OUT');--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"sku" varchar(64) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"line_gross" numeric(14, 2) NOT NULL,
	"line_patronage" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(128) NOT NULL,
	"guest_email" varchar(255),
	"participant_id" uuid,
	"vendor_code" varchar(64) NOT NULL,
	"status" "order_status" DEFAULT 'PENDING_PICKUP' NOT NULL,
	"gross_amount" numeric(14, 2) NOT NULL,
	"sales_amount" numeric(14, 2) NOT NULL,
	"vendor_payable_amount" numeric(14, 2) NOT NULL,
	"cogs_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"patronage_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"memo" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "patronage_accruals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_normalized" varchar(255) NOT NULL,
	"participant_id" uuid,
	"order_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"status" "patronage_accrual_status" DEFAULT 'ACCRUED' NOT NULL,
	"linked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"sku" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(128) DEFAULT 'General' NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"sales_per_unit" numeric(14, 2) NOT NULL,
	"vendor_payable_per_unit" numeric(14, 2) NOT NULL,
	"cogs_per_unit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"patronage_per_unit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patronage_accruals" ADD CONSTRAINT "patronage_accruals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_vendor_sku_idx" ON "products" USING btree ("vendor_id","sku");