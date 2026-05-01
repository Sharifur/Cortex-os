CREATE TABLE IF NOT EXISTS "livechat_session_feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL REFERENCES "livechat_sessions"("id") ON DELETE CASCADE,
  "site_id" text NOT NULL REFERENCES "livechat_sites"("id") ON DELETE CASCADE,
  "rating" text NOT NULL,
  "comment" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "livechat_session_feedback_site_id_idx" ON "livechat_session_feedback" ("site_id");
CREATE UNIQUE INDEX IF NOT EXISTS "livechat_session_feedback_session_id_uniq" ON "livechat_session_feedback" ("session_id");
