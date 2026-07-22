DO $$ BEGIN
  CREATE TYPE "seller_kind" AS ENUM('COOP', 'MEMBER', 'PARTNER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "delivery_tier" AS ENUM('standard', 'bulky', 'remote');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
  "default_delivery_per_item" numeric(14, 2) DEFAULT '50.00' NOT NULL,
  "max_delivery_per_order" numeric(14, 2) DEFAULT '500.00' NOT NULL,
  "default_partner_listing_fee_percent" numeric(5, 2) DEFAULT '10.00' NOT NULL,
  "patronage_rate_percent" numeric(5, 2) DEFAULT '8.00' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "platform_settings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "seller_kind" "seller_kind" DEFAULT 'MEMBER' NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pickup_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pickup_address" varchar(512);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pickup_landmark" varchar(255);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pickup_hours" varchar(255);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pickup_instructions" text;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pickup_phone" varchar(32);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "delivery_per_item" numeric(14, 2);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "partner_listing_fee_percent" numeric(5, 2);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "listing_fee_percent" numeric(5, 2);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "delivery_per_item" numeric(14, 2);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "delivery_tier" "delivery_tier" DEFAULT 'standard' NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "patronage_eligible" boolean DEFAULT true NOT NULL;
