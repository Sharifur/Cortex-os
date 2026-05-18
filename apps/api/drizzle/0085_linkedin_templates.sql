CREATE TABLE IF NOT EXISTS "linkedin_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "template_number" integer,
  "stage" text NOT NULL,
  "category" text NOT NULL,
  "target_role" text,
  "industry" text,
  "body" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL
);