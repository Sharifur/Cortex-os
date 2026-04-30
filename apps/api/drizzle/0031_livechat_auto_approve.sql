-- Auto-approve becomes the default (live chat is automation-first).
-- Existing sites are flipped to true so behavior matches the new default;
-- if any site truly wants moderation, the operator flips it back in the UI.

ALTER TABLE "livechat_sites" ALTER COLUMN "auto_approve" SET DEFAULT true;
UPDATE "livechat_sites" SET "auto_approve" = true WHERE "auto_approve" = false;

-- Per-message moderation flag. When true, the agent draft is saved but
-- withheld from the visitor until an operator approves.
ALTER TABLE "livechat_messages"
  ADD COLUMN IF NOT EXISTS "pending_approval" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "livechat_messages_pending_idx"
  ON "livechat_messages" ("session_id") WHERE "pending_approval" = true;
