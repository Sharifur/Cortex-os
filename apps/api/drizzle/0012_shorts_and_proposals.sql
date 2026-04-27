-- KB self-improvement proposals
CREATE TABLE IF NOT EXISTS "kb_proposals" (
  "id"                  text PRIMARY KEY NOT NULL,
  "agent_key"           text NOT NULL,
  "proposed_entry_type" text NOT NULL,
  "title"               text NOT NULL,
  "content"             text NOT NULL,
  "polarity"            text,
  "reasoning"           text,
  "telegram_message_id" text,
  "status"              text NOT NULL DEFAULT 'pending',
  "created_at"          timestamp NOT NULL DEFAULT now()
);

-- YouTube Shorts / Reels scripts
CREATE TABLE IF NOT EXISTS "shorts_scripts" (
  "id"               text PRIMARY KEY NOT NULL,
  "title"            text NOT NULL,
  "hook"             text NOT NULL,
  "voiceover"        text NOT NULL,
  "visual_brief"     text NOT NULL,
  "canva_design_id"  text,
  "canva_design_url" text,
  "brand"            text NOT NULL DEFAULT 'taskip',
  "topic"            text NOT NULL,
  "duration_secs"    integer NOT NULL DEFAULT 30,
  "status"           text NOT NULL DEFAULT 'draft',
  "created_at"       timestamp NOT NULL DEFAULT now()
);
