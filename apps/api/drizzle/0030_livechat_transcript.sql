-- Per-site transcript-on-close email config + per-session timestamp.

ALTER TABLE "livechat_sites"
  ADD COLUMN IF NOT EXISTS "transcript_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "transcript_bcc" text,
  ADD COLUMN IF NOT EXISTS "transcript_from" text;

ALTER TABLE "livechat_sessions"
  ADD COLUMN IF NOT EXISTS "transcript_sent_at" timestamp;
