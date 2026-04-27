CREATE TABLE IF NOT EXISTS "email_items" (
	"id" text PRIMARY KEY NOT NULL,
	"external_msg_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"from" text NOT NULL,
	"subject" text NOT NULL,
	"snippet" text NOT NULL,
	"classification" text,
	"draft_reply" text,
	"status" text DEFAULT 'new' NOT NULL,
	"received_at" timestamp NOT NULL,
	"processed_at" timestamp,
	CONSTRAINT "email_items_external_msg_id_unique" UNIQUE("external_msg_id")
);
