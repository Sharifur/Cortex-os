-- Per-site widget configuration: branding, persona, position, LLM override.
-- Lets one cortex-os deployment serve different chat experiences across sites.

ALTER TABLE "livechat_sites"
  ADD COLUMN IF NOT EXISTS "bot_name" text,
  ADD COLUMN IF NOT EXISTS "bot_subtitle" text,
  ADD COLUMN IF NOT EXISTS "welcome_message" text,
  ADD COLUMN IF NOT EXISTS "brand_color" text,
  ADD COLUMN IF NOT EXISTS "position" text NOT NULL DEFAULT 'bottom-right',
  ADD COLUMN IF NOT EXISTS "llm_provider" text,
  ADD COLUMN IF NOT EXISTS "llm_model" text;
