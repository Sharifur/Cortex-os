CREATE TABLE IF NOT EXISTS "livechat_operators" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "avatar_url" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "site_keys" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
