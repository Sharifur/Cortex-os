ALTER TABLE "livechat_sites" ADD COLUMN IF NOT EXISTS "topic_handling_rules" text;
ALTER TABLE "livechat_messages" ADD COLUMN IF NOT EXISTS "visitor_rating" text;
