ALTER TABLE "taskip_internal_emails" ADD COLUMN IF NOT EXISTS "tracking_token" text;
ALTER TABLE "taskip_internal_emails" ADD COLUMN IF NOT EXISTS "open_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "taskip_internal_emails" ADD COLUMN IF NOT EXISTS "first_open_at" timestamp;
ALTER TABLE "taskip_internal_emails" ADD COLUMN IF NOT EXISTS "last_open_at" timestamp;
ALTER TABLE "taskip_internal_emails" ADD COLUMN IF NOT EXISTS "open_events" jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS "taskip_internal_emails_tracking_token_idx" ON "taskip_internal_emails" ("tracking_token") WHERE tracking_token IS NOT NULL;
