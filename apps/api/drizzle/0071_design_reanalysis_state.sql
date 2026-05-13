CREATE TABLE IF NOT EXISTS "design_reanalysis_state" (
  "brand" text PRIMARY KEY,
  "done" integer NOT NULL DEFAULT 0,
  "total" integer NOT NULL DEFAULT 0,
  "errors" integer NOT NULL DEFAULT 0,
  "running" boolean NOT NULL DEFAULT false,
  "cancelled" boolean NOT NULL DEFAULT false,
  "failed_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "started_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);
