-- Safety catch-up: ensure email_suppressions and open-tracking columns exist.
-- 0062 and 0063 may have been recorded as applied in __drizzle_migrations but
-- the actual DDL never committed (Drizzle marks the row before the SQL runs on
-- some error paths). All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- so this is fully idempotent.

CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "reason" text NOT NULL,
  "source" text NOT NULL DEFAULT 'ses',
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_suppressions_email_unique" UNIQUE("email")
);

ALTER TABLE "taskip_internal_emails" ADD COLUMN IF NOT EXISTS "tracking_token" text;
ALTER TABLE "taskip_internal_emails" ADD COLUMN IF NOT EXISTS "open_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "taskip_internal_emails" ADD COLUMN IF NOT EXISTS "first_open_at" timestamp;
ALTER TABLE "taskip_internal_emails" ADD COLUMN IF NOT EXISTS "last_open_at" timestamp;
ALTER TABLE "taskip_internal_emails" ADD COLUMN IF NOT EXISTS "open_events" jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS "taskip_internal_emails_tracking_token_idx"
  ON "taskip_internal_emails" ("tracking_token")
  WHERE tracking_token IS NOT NULL;
