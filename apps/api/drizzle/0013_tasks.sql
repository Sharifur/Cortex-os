CREATE TABLE IF NOT EXISTS "tasks" (
  "id"               text PRIMARY KEY NOT NULL,
  "title"            text NOT NULL,
  "instructions"     text NOT NULL,
  "agent_key"        text NOT NULL,
  "status"           text NOT NULL DEFAULT 'pending',
  "output"           jsonb,
  "run_id"           text,
  "recurrence"       text,
  "recurrence_time"  text,
  "next_run_at"      timestamp,
  "created_at"       timestamp NOT NULL DEFAULT now(),
  "updated_at"       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tasks_agent_key_idx" ON "tasks" (agent_key);
CREATE INDEX IF NOT EXISTS "tasks_next_run_idx" ON "tasks" (next_run_at) WHERE next_run_at IS NOT NULL;
