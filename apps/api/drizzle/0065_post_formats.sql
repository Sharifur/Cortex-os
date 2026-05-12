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
