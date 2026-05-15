CREATE TABLE IF NOT EXISTS "linkedin_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "unipile_account_id" text NOT NULL,
  "label" text NOT NULL,
  "profile_url" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "linkedin_accounts_unipile_account_id_unique" UNIQUE("unipile_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "linkedin_niches" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL REFERENCES "linkedin_accounts"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "target_job_titles" text[] NOT NULL DEFAULT '{}',
  "target_industries" text[] NOT NULL DEFAULT '{}',
  "keywords" text[] NOT NULL DEFAULT '{}',
  "icp_description" text,
  "daily_connect_limit" integer NOT NULL DEFAULT 5,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "linkedin_connection_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL REFERENCES "linkedin_accounts"("id"),
  "niche_id" text REFERENCES "linkedin_niches"("id"),
  "profile_id" text NOT NULL,
  "profile_name" text NOT NULL,
  "profile_headline" text,
  "profile_url" text,
  "status" text NOT NULL DEFAULT 'pending',
  "note_sent" text,
  "icp_score" real,
  "icp_reason" text,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "linkedin_leads" ADD COLUMN IF NOT EXISTS "account_id" text REFERENCES "linkedin_accounts"("id");
--> statement-breakpoint
ALTER TABLE "linkedin_leads" ADD COLUMN IF NOT EXISTS "niche_id" text REFERENCES "linkedin_niches"("id");
--> statement-breakpoint
ALTER TABLE "linkedin_leads" ADD COLUMN IF NOT EXISTS "icp_score" real;
--> statement-breakpoint
ALTER TABLE "linkedin_leads" ADD COLUMN IF NOT EXISTS "icp_reason" text;
--> statement-breakpoint
ALTER TABLE "linkedin_leads" ADD COLUMN IF NOT EXISTS "connection_status" text NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE "linkedin_posts" ADD COLUMN IF NOT EXISTS "account_id" text REFERENCES "linkedin_accounts"("id");
