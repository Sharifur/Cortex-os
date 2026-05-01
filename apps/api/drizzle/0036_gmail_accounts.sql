CREATE TABLE IF NOT EXISTS "gmail_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "display_name" text,
  "app_password_encrypted" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gmail_accounts_is_default_idx" ON "gmail_accounts" ("is_default");
