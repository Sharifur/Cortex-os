CREATE TABLE "support_webhook_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "status" text NOT NULL,
  "external_id" text,
  "ticket_id" text,
  "raw_payload" text,
  "error" text,
  "received_at" timestamp DEFAULT now() NOT NULL
);
