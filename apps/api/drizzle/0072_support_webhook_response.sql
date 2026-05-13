-- Ensure the table exists in case earlier migrations (0064/0066) did not apply cleanly.
CREATE TABLE IF NOT EXISTS "support_webhook_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "status" text NOT NULL,
  "external_id" text,
  "ticket_id" text,
  "raw_payload" text,
  "error" text,
  "received_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "support_webhook_logs" ADD COLUMN IF NOT EXISTS "response_body" text;
