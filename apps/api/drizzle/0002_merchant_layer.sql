CREATE TYPE "public"."seller_application_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED');--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "slug" varchar(128);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "owner_email" varchar(255);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "description" text;--> statement-breakpoint
UPDATE "vendors" SET "slug" = lower(replace("code", '_', '-')) WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_slug_unique" UNIQUE("slug");--> statement-breakpoint
CREATE TABLE "seller_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_email" varchar(255) NOT NULL,
	"business_name" varchar(255) NOT NULL,
	"business_type" varchar(64) DEFAULT 'product' NOT NULL,
	"contact_phone" varchar(32),
	"description" text,
	"proposed_vendor_code" varchar(64),
	"status" "seller_application_status" DEFAULT 'PENDING' NOT NULL,
	"vendor_id" uuid,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "listing_status" "listing_status" DEFAULT 'ACTIVE' NOT NULL;
