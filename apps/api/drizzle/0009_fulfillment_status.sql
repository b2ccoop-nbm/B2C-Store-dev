DO $$ BEGIN
  CREATE TYPE "fulfillment_status" AS ENUM('pending', 'packed', 'out_for_delivery', 'delivered');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment_status" "fulfillment_status" DEFAULT 'pending' NOT NULL;
