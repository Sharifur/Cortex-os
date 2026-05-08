CREATE TABLE "taskip_internal_suggestions" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_uuid" text NOT NULL,
  "owner_email" text NOT NULL,
  "owner_name" text NOT NULL,
  "cohort" text NOT NULL,
  "scenario_key" text NOT NULL,
  "score" integer NOT NULL,
  "score_tier" integer NOT NULL,
  "lifecycle_state" text NOT NULL,
  "days_since_signup" integer NOT NULL,
  "subject" text NOT NULL,
  "body_md" text NOT NULL,
  "cta_text" text,
  "cta_url" text,
  "channel" text NOT NULL,
  "channel_locked_at" timestamp NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "failed_reason" text,
  "sent_email_id" text,
  "insight_message_id" integer,
  "approved_at" timestamp,
  "sent_at" timestamp,
  "skipped_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskip_internal_workspace_activity" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_uuid" text NOT NULL,
  "activity_type" text NOT NULL,
  "suggestion_id" text,
  "email_id" text,
  "score" integer,
  "cohort" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "taskip_internal_suggestions_workspace_idx" ON "taskip_internal_suggestions" ("workspace_uuid");
--> statement-breakpoint
CREATE INDEX "taskip_internal_suggestions_status_idx" ON "taskip_internal_suggestions" ("status");
--> statement-breakpoint
CREATE INDEX "taskip_internal_suggestions_cohort_idx" ON "taskip_internal_suggestions" ("cohort");
--> statement-breakpoint
CREATE UNIQUE INDEX "taskip_internal_suggestions_pending_uniq" ON "taskip_internal_suggestions" ("workspace_uuid") WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX "taskip_internal_workspace_activity_workspace_idx" ON "taskip_internal_workspace_activity" ("workspace_uuid");
--> statement-breakpoint
CREATE INDEX "taskip_internal_workspace_activity_type_idx" ON "taskip_internal_workspace_activity" ("activity_type");
--> statement-breakpoint
CREATE INDEX "taskip_internal_workspace_activity_created_at_idx" ON "taskip_internal_workspace_activity" ("created_at");
