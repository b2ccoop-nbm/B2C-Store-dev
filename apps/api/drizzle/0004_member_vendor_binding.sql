ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "firebase_uid" varchar(128);
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_firebase_uid_idx" ON "vendors" ("firebase_uid") WHERE "firebase_uid" IS NOT NULL;

ALTER TABLE "seller_applications" ADD COLUMN IF NOT EXISTS "applicant_firebase_uid" varchar(128);
ALTER TABLE "seller_applications" ADD COLUMN IF NOT EXISTS "status_token_hash" varchar(64);
