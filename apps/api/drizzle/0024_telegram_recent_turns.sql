ALTER TABLE "telegram_chat_state"
  ADD COLUMN IF NOT EXISTS "recent_turns" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "telegram_chat_state"
  ADD COLUMN IF NOT EXISTS "last_route_instructions" text;
