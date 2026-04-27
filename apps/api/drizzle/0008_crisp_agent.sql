CREATE TABLE IF NOT EXISTS "crisp_conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL UNIQUE,
  "website_id" text NOT NULL,
  "visitor_email" text,
  "visitor_nickname" text,
  "last_message" text NOT NULL,
  "draft_reply" text,
  "status" text DEFAULT 'new' NOT NULL,
  "received_at" timestamp NOT NULL,
  "replied_at" timestamp
);
