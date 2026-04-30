CREATE TABLE IF NOT EXISTS "llm_usage_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text,
  "agent_key" text,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "cached_input_tokens" integer NOT NULL DEFAULT 0,
  "cost_usd" numeric(14, 8) NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "llm_usage_logs_created_idx"
  ON "llm_usage_logs" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "llm_usage_logs_agent_idx"
  ON "llm_usage_logs" ("agent_key");
CREATE INDEX IF NOT EXISTS "llm_usage_logs_model_idx"
  ON "llm_usage_logs" ("provider", "model");
