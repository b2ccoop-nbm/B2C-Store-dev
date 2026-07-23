ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "short_description" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "highlights" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "features" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_urls" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE "products"
SET "image_urls" = jsonb_build_array("image_url")
WHERE "image_url" IS NOT NULL
  AND ("image_urls" IS NULL OR "image_urls" = '[]'::jsonb);
