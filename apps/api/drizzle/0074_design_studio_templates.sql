CREATE TABLE IF NOT EXISTS "design_studio_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "preview_data" text,
  "parameters" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "spec" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
