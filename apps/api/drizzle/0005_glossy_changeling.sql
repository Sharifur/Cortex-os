CREATE TABLE IF NOT EXISTS "taskip_internal_ops" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"op_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
