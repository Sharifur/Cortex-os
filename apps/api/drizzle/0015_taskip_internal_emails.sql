CREATE TABLE IF NOT EXISTS "taskip_internal_emails" (
  "id" text PRIMARY KEY NOT NULL,
  "purpose" text NOT NULL,
  "workspace_uuid" text,
  "recipient" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "gmail_message_id" text,
  "gmail_thread_id" text,
  "status" text DEFAULT 'sent' NOT NULL,
  "error" text,
  "reply_count" integer DEFAULT 0 NOT NULL,
  "last_reply_at" timestamp,
  "last_synced_at" timestamp,
  "metadata" jsonb,
  "sent_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "taskip_internal_emails_thread_idx" ON "taskip_internal_emails" ("gmail_thread_id");
CREATE INDEX IF NOT EXISTS "taskip_internal_emails_workspace_idx" ON "taskip_internal_emails" ("workspace_uuid");
CREATE INDEX IF NOT EXISTS "taskip_internal_emails_sent_at_idx" ON "taskip_internal_emails" ("sent_at");

CREATE TABLE IF NOT EXISTS "taskip_internal_email_replies" (
  "id" text PRIMARY KEY NOT NULL,
  "email_id" text NOT NULL,
  "gmail_message_id" text NOT NULL,
  "gmail_thread_id" text NOT NULL,
  "from_address" text NOT NULL,
  "snippet" text,
  "body" text,
  "received_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "taskip_internal_email_replies_email_idx" ON "taskip_internal_email_replies" ("email_id");
CREATE UNIQUE INDEX IF NOT EXISTS "taskip_internal_email_replies_msg_uniq" ON "taskip_internal_email_replies" ("gmail_message_id");
