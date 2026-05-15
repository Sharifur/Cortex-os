CREATE TABLE IF NOT EXISTS "support_ticket_events" (
  "id" text PRIMARY KEY NOT NULL,
  "ticket_id" text,
  "external_id" text,
  "event_type" text NOT NULL,
  "summary" text,
  "payload" jsonb,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "support_ticket_events_ticket_id_idx" ON "support_ticket_events" ("ticket_id");
CREATE INDEX IF NOT EXISTS "support_ticket_events_external_id_idx" ON "support_ticket_events" ("external_id");
