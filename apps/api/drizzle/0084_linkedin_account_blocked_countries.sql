ALTER TABLE "linkedin_accounts" ADD COLUMN IF NOT EXISTS "blocked_countries" text[] NOT NULL DEFAULT '{}';
