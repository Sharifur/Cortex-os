CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "reason" text NOT NULL,
  "source" text NOT NULL DEFAULT 'ses',
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_suppressions_email_unique" UNIQUE("email")
);
