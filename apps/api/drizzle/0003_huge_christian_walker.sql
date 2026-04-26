CREATE TABLE IF NOT EXISTS "taskip_trial_email_log" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"segment" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"ses_message_id" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "taskip_trial_suppressed" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "taskip_trial_suppressed_email_unique" UNIQUE("email")
);
