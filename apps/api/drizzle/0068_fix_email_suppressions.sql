-- 0067 was recorded in __drizzle_migrations before its DDL committed on some
-- environments. This migration re-creates the table idempotently so it is
-- guaranteed to exist after this entry is applied.
CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "reason" text NOT NULL,
  "source" text NOT NULL DEFAULT 'ses',
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_suppressions_email_unique" UNIQUE("email")
);
