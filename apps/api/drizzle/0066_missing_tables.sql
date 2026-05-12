-- Catches up tables that were written as raw SQL files (0064, 0065) without
-- being added to the migration journal. Using IF NOT EXISTS so this is safe
-- to run even if any were partially applied manually.

-- From 0064: support webhook logs
CREATE TABLE IF NOT EXISTS "support_webhook_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "status" text NOT NULL,
  "external_id" text,
  "ticket_id" text,
  "raw_payload" text,
  "error" text,
  "received_at" timestamp DEFAULT now() NOT NULL
);

-- From 0065: post format engine tables
CREATE TABLE IF NOT EXISTS "post_formats" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "platform" text NOT NULL,
  "category" text NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "slide_count" integer NOT NULL DEFAULT 1,
  "schema" jsonb NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "post_renders" (
  "id" text PRIMARY KEY,
  "format_id" text NOT NULL,
  "brand" text NOT NULL,
  "topic" text,
  "intent" text,
  "filled_content" jsonb NOT NULL,
  "slide_urls" text[] NOT NULL DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'draft',
  "telegram_message_id" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
