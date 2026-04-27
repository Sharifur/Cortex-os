CREATE TABLE IF NOT EXISTS "knowledge_entries" (
  "id"             text PRIMARY KEY NOT NULL,
  "title"          text NOT NULL,
  "content"        text NOT NULL,
  "category"       text NOT NULL DEFAULT 'general',
  "entry_type"     text NOT NULL DEFAULT 'reference',
  "priority"       integer NOT NULL DEFAULT 50,
  "agent_keys"     text,
  "source_type"    text NOT NULL DEFAULT 'manual',
  "source_url"     text,
  "parent_doc_id"  text,
  "created_at"     timestamp NOT NULL DEFAULT now(),
  "updated_at"     timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "writing_samples" (
  "id"          text PRIMARY KEY NOT NULL,
  "context"     text NOT NULL,
  "sample_text" text NOT NULL,
  "polarity"    text NOT NULL DEFAULT 'positive',
  "agent_keys"  text,
  "created_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ke_fts_idx"
  ON "knowledge_entries"
  USING GIN (to_tsvector('english', title || ' ' || content));

CREATE INDEX IF NOT EXISTS "ke_type_idx"
  ON "knowledge_entries" (entry_type);

ALTER TABLE "pending_approvals"
  ADD COLUMN IF NOT EXISTS "rejection_reason" text;
