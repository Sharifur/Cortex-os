-- Seed agent row
INSERT INTO "agents" ("id", "key", "name", "description", "enabled", "config")
VALUES (
  gen_random_uuid()::text,
  'listing_outreach',
  'Listing Outreach Agent',
  'Discovers top-ranked SaaS and AI tool listing sites via Brave Search, scrapes contact emails, scores each site, drafts KB-voiced outreach emails, and routes them through Telegram for approval before sending.',
  false,
  '{"products":[{"domain":"taskip.net","name":"Taskip","queries":["top project management SaaS tools 2025","best SaaS tools for teams directory","client portal software list","best client portal software 2025","project management tool directory"],"outreachGoal":"both"},{"domain":"xgenious.com","name":"Xgenious","queries":["top web development agencies directory 2025","best Laravel development companies list","software development agency directory","hire web developers directory","top custom software development companies"],"outreachGoal":"partnership"}],"monthlyLimit":20,"perRunLimit":10,"minScore":30,"cooldownDays":30}'::jsonb
) ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS listing_prospects (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  site_name TEXT,
  site_url TEXT NOT NULL,
  description TEXT,
  contact_email TEXT,
  linkedin_profile_url TEXT,
  linkedin_name TEXT,
  linkedin_headline TEXT,
  outreach_goal TEXT NOT NULL DEFAULT 'both',
  status TEXT NOT NULL DEFAULT 'discovered',
  quality_score INTEGER,
  open_page_rank NUMERIC(4,1),
  search_rank INTEGER,
  submit_url TEXT,
  contact_form_url TEXT,
  email_id TEXT,
  search_query TEXT,
  gmail_account_id TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_contact_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
