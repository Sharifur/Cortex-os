CREATE TABLE IF NOT EXISTS "telegram_chat_state" (
  "chat_id" text PRIMARY KEY NOT NULL,
  "pending_reminder_message" text,
  "pending_reminder_expires_at" timestamp,
  "last_route_agent_key" text,
  "last_run_id" text,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "telegram_routing_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "chat_id" text NOT NULL,
  "inbound_text" text NOT NULL,
  "decided_kind" text NOT NULL,
  "decided_agent_key" text,
  "confidence" real,
  "latency_ms" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "telegram_routing_logs_chat_idx"
  ON "telegram_routing_logs" ("chat_id", "created_at" DESC);
