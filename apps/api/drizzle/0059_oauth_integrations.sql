-- OAuth Integration Hub: server-side OAuth token storage for MCP providers
CREATE TABLE IF NOT EXISTS "oauth_integrations" (
  "id"                text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "provider"          text NOT NULL,                 -- 'canva' | 'github' | 'notion' | etc.
  "display_name"      text NOT NULL,
  "status"            text NOT NULL DEFAULT 'disconnected', -- 'connected' | 'disconnected' | 'expired' | 'error'
  "access_token"      text,                          -- encrypted via settings encryption key
  "refresh_token"     text,                          -- encrypted
  "token_type"        text DEFAULT 'Bearer',
  "scope"             text,
  "expires_at"        timestamptz,
  "connected_at"      timestamptz,
  "last_refreshed_at" timestamptz,
  "error_message"     text,
  "metadata"          jsonb DEFAULT '{}'::jsonb,     -- provider-specific extra data
  "created_at"        timestamptz NOT NULL DEFAULT now(),
  "updated_at"        timestamptz NOT NULL DEFAULT now(),
  UNIQUE("provider")
);

-- Link MCP servers to an OAuth integration for automatic token injection
ALTER TABLE "mcp_servers"
  ADD COLUMN IF NOT EXISTS "oauth_integration_id" text REFERENCES "oauth_integrations"("id") ON DELETE SET NULL;
