ALTER TABLE "knowledge_entries" ADD COLUMN IF NOT EXISTS "site_keys" text;
ALTER TABLE "knowledge_entries" ADD COLUMN IF NOT EXISTS "excluded_site_keys" text;
ALTER TABLE "writing_samples" ADD COLUMN IF NOT EXISTS "site_keys" text;
ALTER TABLE "writing_samples" ADD COLUMN IF NOT EXISTS "excluded_site_keys" text;

-- Migrate any single-site values into the new include CSV column.
UPDATE "knowledge_entries" SET "site_keys" = "site_key" WHERE "site_key" IS NOT NULL AND "site_key" <> '';
UPDATE "writing_samples"   SET "site_keys" = "site_key" WHERE "site_key" IS NOT NULL AND "site_key" <> '';

ALTER TABLE "knowledge_entries" DROP COLUMN IF EXISTS "site_key";
ALTER TABLE "writing_samples"   DROP COLUMN IF EXISTS "site_key";

CREATE INDEX IF NOT EXISTS "knowledge_entries_site_keys_idx" ON "knowledge_entries" ("site_keys");
CREATE INDEX IF NOT EXISTS "writing_samples_site_keys_idx"   ON "writing_samples" ("site_keys");
