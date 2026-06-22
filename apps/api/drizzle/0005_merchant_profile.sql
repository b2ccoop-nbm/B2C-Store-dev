ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "contact_phone" varchar(32);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "business_type" varchar(64) DEFAULT 'product' NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pending_name" varchar(255);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pending_slug" varchar(128);
