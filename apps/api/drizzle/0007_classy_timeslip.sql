CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"external_id" text,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"user_email" text NOT NULL,
	"category" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to" text,
	"last_draft" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"external_msg_id" text NOT NULL,
	"from_number" text NOT NULL,
	"from_name" text,
	"body" text NOT NULL,
	"importance" text,
	"drafted_reply" text,
	"media_key" text,
	"status" text DEFAULT 'new' NOT NULL,
	"received_at" timestamp NOT NULL,
	"processed_at" timestamp,
	CONSTRAINT "whatsapp_messages_external_msg_id_unique" UNIQUE("external_msg_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "linkedin_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_url" text NOT NULL,
	"name" text,
	"headline" text,
	"status" text DEFAULT 'new' NOT NULL,
	"last_contacted_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "linkedin_leads_profile_url_unique" UNIQUE("profile_url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "linkedin_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"author_name" text,
	"content" text NOT NULL,
	"draft_comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"posted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "linkedin_posts_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reddit_keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"keyword" text NOT NULL,
	"subreddits" text,
	"active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reddit_keywords_keyword_unique" UNIQUE("keyword")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reddit_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"subreddit" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"body" text,
	"draft_comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_engaged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reddit_threads_thread_id_unique" UNIQUE("thread_id")
);
