CREATE TABLE IF NOT EXISTS "agent_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_key" text NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"run_id" text,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
