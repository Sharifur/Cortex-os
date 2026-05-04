ALTER TABLE "kb_proposals"
  ADD COLUMN "site_key"      text,
  ADD COLUMN "session_id"    text,
  ADD COLUMN "category"      text,
  ADD COLUMN "source_type"   text NOT NULL DEFAULT 'correction';
