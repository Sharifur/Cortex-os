ALTER TABLE "knowledge_entries" ADD COLUMN IF NOT EXISTS "valid_until" timestamp;
CREATE INDEX IF NOT EXISTS "knowledge_entries_valid_until_idx" ON "knowledge_entries" ("valid_until");
