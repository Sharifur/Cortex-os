ALTER TABLE "livechat_sessions" ADD COLUMN IF NOT EXISTS "needs_human_at" timestamp;
ALTER TABLE "livechat_sessions" ADD COLUMN IF NOT EXISTS "human_alert_sent_at" timestamp;
ALTER TABLE "livechat_sites" ADD COLUMN IF NOT EXISTS "human_alert_email" text;
