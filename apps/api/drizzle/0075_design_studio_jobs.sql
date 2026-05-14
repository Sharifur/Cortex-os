CREATE TABLE IF NOT EXISTS "design_studio_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "error" text,
  "template_id" text,
  "preview_data" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
