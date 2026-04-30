-- Live chat module: per-site config, visitors with enrichment, pageviews, sessions, messages.

CREATE TABLE IF NOT EXISTS "livechat_sites" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "origin" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "product_context" text,
  "reply_tone" text,
  "track_bots" boolean DEFAULT false NOT NULL,
  "auto_approve" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "livechat_sites_key_unique" UNIQUE("key")
);

CREATE INDEX IF NOT EXISTS "livechat_sites_origin_idx" ON "livechat_sites" ("origin");

CREATE TABLE IF NOT EXISTS "livechat_visitors" (
  "id" text PRIMARY KEY NOT NULL,
  "site_id" text NOT NULL,
  "visitor_id" text NOT NULL,
  "first_seen_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "ip" text,
  "ip_country" text,
  "ip_country_name" text,
  "ip_region" text,
  "ip_city" text,
  "ip_lat" numeric(8, 5),
  "ip_lon" numeric(8, 5),
  "ip_timezone" text,
  "ip_isp" text,
  "ua_raw" text,
  "browser_name" text,
  "browser_version" text,
  "os_name" text,
  "os_version" text,
  "device_type" text,
  "device_brand" text,
  "device_model" text,
  "language" text,
  "total_sessions" integer DEFAULT 0 NOT NULL,
  "total_messages" integer DEFAULT 0 NOT NULL,
  "total_pageviews" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "livechat_visitors_site_visitor_unique" UNIQUE("site_id", "visitor_id")
);

CREATE INDEX IF NOT EXISTS "livechat_visitors_site_idx" ON "livechat_visitors" ("site_id");
CREATE INDEX IF NOT EXISTS "livechat_visitors_country_idx" ON "livechat_visitors" ("ip_country");
CREATE INDEX IF NOT EXISTS "livechat_visitors_last_seen_idx" ON "livechat_visitors" ("last_seen_at");

CREATE TABLE IF NOT EXISTS "livechat_pageviews" (
  "id" text PRIMARY KEY NOT NULL,
  "visitor_pk" text NOT NULL,
  "session_id" text,
  "url" text NOT NULL,
  "path" text,
  "title" text,
  "referrer" text,
  "arrived_at" timestamp DEFAULT now() NOT NULL,
  "left_at" timestamp,
  "duration_ms" integer,
  "seq" integer
);

CREATE INDEX IF NOT EXISTS "livechat_pageviews_visitor_idx" ON "livechat_pageviews" ("visitor_pk", "arrived_at" DESC);
CREATE INDEX IF NOT EXISTS "livechat_pageviews_session_idx" ON "livechat_pageviews" ("session_id");

CREATE TABLE IF NOT EXISTS "livechat_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "site_id" text NOT NULL,
  "visitor_pk" text NOT NULL,
  "visitor_id" text NOT NULL,
  "contact_id" text,
  "visitor_email" text,
  "visitor_name" text,
  "status" text DEFAULT 'open' NOT NULL,
  "current_page_url" text,
  "current_page_title" text,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "livechat_sessions_site_visitor_unique" UNIQUE("site_id", "visitor_id")
);

CREATE INDEX IF NOT EXISTS "livechat_sessions_status_idx" ON "livechat_sessions" ("status");
CREATE INDEX IF NOT EXISTS "livechat_sessions_last_seen_idx" ON "livechat_sessions" ("last_seen_at" DESC);
CREATE INDEX IF NOT EXISTS "livechat_sessions_contact_idx" ON "livechat_sessions" ("contact_id");

CREATE TABLE IF NOT EXISTS "livechat_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "livechat_messages_session_idx" ON "livechat_messages" ("session_id", "created_at");

INSERT INTO "agents" ("id", "key", "name", "description", "enabled", "config")
VALUES (
  gen_random_uuid()::text,
  'livechat',
  'Live Chat Agent',
  'Self-hosted AI live chat for bytesed.com, xgenious.com and taskip.net. Visitor messages flow through the KB pipeline; admin inbox handles human takeover.',
  false,
  '{"replyTone":"friendly, concise, and helpful — like a knowledgeable founder replying to a customer","productContext":"","selfCritiqueRetries":1,"llm":{"provider":"auto","model":"gpt-4o-mini"}}'::jsonb
)
ON CONFLICT ("key") DO NOTHING;
