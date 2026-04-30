-- Web Push subscriptions per operator. Operators can subscribe from
-- multiple devices (phone PWA + desktop browser) — each is a separate row
-- keyed by endpoint.

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "ua" text,
  "label" text,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE ("endpoint")
);

CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" ("user_id");
