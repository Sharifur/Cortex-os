-- Operator-configured tappable suggestions shown alongside the welcome
-- message. Stored as a newline- or comma-separated list of short labels.
-- Each label is also the message text that gets sent when the visitor taps.

ALTER TABLE "livechat_sites"
  ADD COLUMN IF NOT EXISTS "welcome_quick_replies" text;
