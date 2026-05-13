ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "purchase_code_status" text,
  ADD COLUMN IF NOT EXISTS "purchase_code" text;
