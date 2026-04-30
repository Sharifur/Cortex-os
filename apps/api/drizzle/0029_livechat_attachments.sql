-- File attachments uploaded by visitors or operators inside a chat session.
-- Storage backend: Cloudflare R2 (S3-compatible). r2_key is the object path
-- inside the bucket; resolved to a public/CDN URL at read time.

CREATE TABLE IF NOT EXISTS "livechat_attachments" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "message_id" text,
  "uploader_role" text NOT NULL,
  "uploader_id" text,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "r2_key" text NOT NULL,
  "original_filename" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "livechat_attachments_session_idx" ON "livechat_attachments" ("session_id");
CREATE INDEX IF NOT EXISTS "livechat_attachments_message_idx" ON "livechat_attachments" ("message_id");
