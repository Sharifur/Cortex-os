-- Drop old HR stub tables (XGHRM is now the source of truth)
DROP TABLE IF EXISTS "hr_leave_requests";
DROP TABLE IF EXISTS "hr_employees";
DROP TABLE IF EXISTS "hr_salary_sheets";

-- Run-state tracker for the monthly payslip Telegram approval flow
CREATE TABLE IF NOT EXISTS "hr_payslip_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "month" text NOT NULL,
  "xghrm_id" text NOT NULL UNIQUE,
  "employee_id" text NOT NULL,
  "employee_name" text NOT NULL,
  "net_salary" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending_tg',
  "telegram_msg_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
