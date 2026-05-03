ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "recurrence_dow" integer;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "recurrence_dom" integer;
