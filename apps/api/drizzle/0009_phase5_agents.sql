-- HR Manager Agent tables
CREATE TABLE IF NOT EXISTS "hr_employees" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "role" text NOT NULL,
  "salary" integer DEFAULT 0 NOT NULL,
  "joined_at" timestamp DEFAULT now() NOT NULL,
  "probation_until" timestamp,
  "contract_ends_at" timestamp,
  "leave_balance" integer DEFAULT 18 NOT NULL,
  "active" text DEFAULT 'true' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "hr_leave_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "employee_id" text NOT NULL,
  "type" text NOT NULL,
  "from_date" date NOT NULL,
  "to_date" date NOT NULL,
  "reason" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "decision_reason" text,
  "decided_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "hr_salary_sheets" (
  "id" text PRIMARY KEY NOT NULL,
  "month" text NOT NULL UNIQUE,
  "line_items" text DEFAULT '[]' NOT NULL,
  "totals" text DEFAULT '{}' NOT NULL,
  "file_key" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "generated_at" timestamp DEFAULT now() NOT NULL,
  "approved_at" timestamp
);

-- Social Media Handler tables
CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" text PRIMARY KEY NOT NULL,
  "brand" text NOT NULL,
  "platform" text NOT NULL,
  "body" text NOT NULL,
  "media_urls" text DEFAULT '[]' NOT NULL,
  "scheduled_for" timestamp NOT NULL,
  "status" text DEFAULT 'scheduled' NOT NULL,
  "external_post_id" text,
  "performance" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "published_at" timestamp
);

CREATE TABLE IF NOT EXISTS "social_engagements" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text,
  "platform" text NOT NULL,
  "type" text NOT NULL,
  "from_user" text NOT NULL,
  "body" text NOT NULL,
  "drafted_reply" text,
  "status" text DEFAULT 'new' NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "replied_at" timestamp
);

-- Canva + Social Content Agent table
CREATE TABLE IF NOT EXISTS "content_ideas" (
  "id" text PRIMARY KEY NOT NULL,
  "month" text NOT NULL,
  "format" text NOT NULL,
  "hook" text NOT NULL,
  "body" text NOT NULL,
  "cta" text NOT NULL,
  "platform" text,
  "brand" text,
  "canva_design_id" text,
  "media_url" text,
  "status" text DEFAULT 'idea' NOT NULL,
  "scheduled_for" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
