CREATE TABLE IF NOT EXISTS "contacts" (
  "id" text PRIMARY KEY NOT NULL,
  "display_name" text,
  "email" text,
  "phone" text,
  "source" text NOT NULL,
  "source_ref" text NOT NULL,
  "website_tag" text,
  "taskip_user_id" text,
  "notes" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "contacts_source_ref_unique" UNIQUE("source", "source_ref")
);

CREATE INDEX IF NOT EXISTS "contacts_email_idx" ON "contacts" ("email");
CREATE INDEX IF NOT EXISTS "contacts_source_idx" ON "contacts" ("source");
CREATE INDEX IF NOT EXISTS "contacts_website_tag_idx" ON "contacts" ("website_tag");

CREATE TABLE IF NOT EXISTS "contact_activity" (
  "id" text PRIMARY KEY NOT NULL,
  "contact_id" text NOT NULL,
  "kind" text NOT NULL,
  "summary" text NOT NULL,
  "ref_id" text,
  "meta" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "contact_activity_contact_id_idx" ON "contact_activity" ("contact_id");
CREATE INDEX IF NOT EXISTS "contact_activity_created_at_idx" ON "contact_activity" ("created_at");

ALTER TABLE "crisp_conversations" ADD COLUMN IF NOT EXISTS "contact_id" text;
ALTER TABLE "crisp_conversations" ADD COLUMN IF NOT EXISTS "follow_up" boolean DEFAULT false NOT NULL;
ALTER TABLE "crisp_conversations" ADD COLUMN IF NOT EXISTS "follow_up_note" text;
ALTER TABLE "crisp_conversations" ADD COLUMN IF NOT EXISTS "follow_up_due_at" timestamp;
ALTER TABLE "crisp_conversations" ADD COLUMN IF NOT EXISTS "follow_up_notified_at" timestamp;
ALTER TABLE "crisp_conversations" ADD COLUMN IF NOT EXISTS "follow_up_resolved_at" timestamp;

CREATE INDEX IF NOT EXISTS "crisp_conversations_follow_up_idx" ON "crisp_conversations" ("follow_up") WHERE "follow_up" = true;
CREATE INDEX IF NOT EXISTS "crisp_conversations_contact_id_idx" ON "crisp_conversations" ("contact_id");
