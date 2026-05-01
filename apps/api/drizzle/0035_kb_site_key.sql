ALTER TABLE "knowledge_entries" ADD COLUMN IF NOT EXISTS "site_key" text;
ALTER TABLE "writing_samples" ADD COLUMN IF NOT EXISTS "site_key" text;
CREATE INDEX IF NOT EXISTS "knowledge_entries_site_key_idx" ON "knowledge_entries" ("site_key");
CREATE INDEX IF NOT EXISTS "writing_samples_site_key_idx" ON "writing_samples" ("site_key");
