DO $$ BEGIN
  CREATE TYPE "fulfillment_mode" AS ENUM('delivery', 'merchant_pickup');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'PENDING_DELIVERY';
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment_mode" "fulfillment_mode" DEFAULT 'delivery' NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_fee_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_address" jsonb;
--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN IF NOT EXISTS "line_delivery_fee" numeric(14, 2) DEFAULT '0.00' NOT NULL;
