CREATE TABLE IF NOT EXISTS "request_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "method" text NOT NULL,
  "path" text NOT NULL,
  "status_code" integer NOT NULL,
  "duration_ms" integer,
  "request_id" text,
  "user_id" text,
  "ip" text,
  "user_agent" text,
  "query_string" text,
  "request_body" text,
  "response_body" text,
  "error_message" text,
  "error_stack" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "request_logs_status_idx" ON "request_logs" ("status_code");
CREATE INDEX IF NOT EXISTS "request_logs_path_idx" ON "request_logs" ("path");
CREATE INDEX IF NOT EXISTS "request_logs_created_idx" ON "request_logs" ("created_at");
