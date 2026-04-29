CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "jti" text NOT NULL,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  CONSTRAINT "auth_sessions_jti_unique" UNIQUE("jti")
);

CREATE INDEX IF NOT EXISTS "auth_sessions_user_idx" ON "auth_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "auth_sessions_jti_idx" ON "auth_sessions" ("jti");
