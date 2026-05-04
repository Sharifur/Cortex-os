CREATE TABLE "livechat_kb_gaps" (
	"id" text PRIMARY KEY NOT NULL,
	"site_key" text NOT NULL,
	"session_id" text NOT NULL,
	"visitor_question" text NOT NULL,
	"escalation_reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "livechat_kb_gaps_site_key_idx" ON "livechat_kb_gaps" ("site_key");
CREATE INDEX "livechat_kb_gaps_created_at_idx" ON "livechat_kb_gaps" ("created_at");
