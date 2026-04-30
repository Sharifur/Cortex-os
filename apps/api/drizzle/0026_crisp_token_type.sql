ALTER TABLE "crisp_websites"
  ADD COLUMN IF NOT EXISTS "token_type" text NOT NULL DEFAULT 'plugin';
