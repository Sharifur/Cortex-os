CREATE TABLE IF NOT EXISTS "crisp_websites" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "website_id" text NOT NULL UNIQUE,
  "identifier" text NOT NULL,
  "api_key" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);
