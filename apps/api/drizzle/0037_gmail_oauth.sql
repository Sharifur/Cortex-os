ALTER TABLE "gmail_accounts" ALTER COLUMN "app_password_encrypted" DROP NOT NULL;
ALTER TABLE "gmail_accounts" ADD COLUMN IF NOT EXISTS "auth_type" text NOT NULL DEFAULT 'imap';
ALTER TABLE "gmail_accounts" ADD COLUMN IF NOT EXISTS "oauth_client_id" text;
ALTER TABLE "gmail_accounts" ADD COLUMN IF NOT EXISTS "oauth_client_secret_encrypted" text;
ALTER TABLE "gmail_accounts" ADD COLUMN IF NOT EXISTS "oauth_refresh_token_encrypted" text;
