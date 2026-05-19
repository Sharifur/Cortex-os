ALTER TABLE "livechat_sessions" ADD COLUMN IF NOT EXISTS "inactivity_email_sent_at" timestamp;
