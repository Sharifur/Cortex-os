CREATE TABLE "livechat_kb_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"kb_entry_id" text NOT NULL,
	"session_id" text NOT NULL,
	"message_id" text NOT NULL,
	"site_key" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "livechat_kb_flags_entry_idx" ON "livechat_kb_flags" ("kb_entry_id");
