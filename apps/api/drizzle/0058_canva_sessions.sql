-- T3 + T29: Canva agent tables
-- canva_brands: per-brand identity (voice, palette, fonts, Canva kit)
CREATE TABLE IF NOT EXISTS "canva_brands" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "voice_profile" text NOT NULL DEFAULT '',
  "palette" jsonb NOT NULL DEFAULT '[]',
  "fonts" jsonb NOT NULL DEFAULT '[]',
  "canva_kit_id" text,
  "platforms" jsonb NOT NULL DEFAULT '[]',
  "logo_url" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- canva_sessions: design generation sessions
CREATE TABLE IF NOT EXISTS "canva_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "brief" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "approval_folder_path" text,
  "total_cost_usd" real NOT NULL DEFAULT 0,
  "iteration" integer NOT NULL DEFAULT 1,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "closed_at" timestamp
);

-- canva_candidates: individual design candidates per session
CREATE TABLE IF NOT EXISTS "canva_candidates" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "backend" text NOT NULL,
  "tool" text,
  "file_path" text,
  "format" text,
  "width" integer,
  "height" integer,
  "size_bytes" integer,
  "sha256" text,
  "phash" text,
  "parent_candidate_id" text,
  "iteration" integer NOT NULL DEFAULT 1,
  "feedback" text,
  "cost_usd" real NOT NULL DEFAULT 0,
  "rationale" text,
  "canva_design_id" text,
  "canva_edit_url" text,
  "thumbnail_path" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- canva_debug_log: per-step debug traces (written only when debugMode=true)
CREATE TABLE IF NOT EXISTS "canva_debug_log" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text,
  "candidate_id" text,
  "step" text NOT NULL,
  "actor" text NOT NULL,
  "data" jsonb,
  "latency_ms" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Seed default brands
INSERT INTO "canva_brands" ("id", "name", "display_name", "voice_profile", "palette", "fonts", "platforms", "active")
VALUES
  ('brand_taskip_001', 'taskip', 'Taskip', 'Educational, relatable, and slightly witty — for SaaS founders and project managers. Focus on productivity, team collaboration, and task management.', '["#6366f1","#4f46e5","#818cf8","#e0e7ff","#1e1b4b"]', '["Inter","Geist"]', '["linkedin","x","instagram","facebook"]', true),
  ('brand_xgenious_001', 'xgenious', 'Xgenious', 'Professional, developer-focused, and technically precise — for WordPress developers and theme buyers. Highlight quality, customization, and support.', '["#f97316","#ea580c","#fed7aa","#7c3aed","#1c1917"]', '["Plus Jakarta Sans","Geist Mono"]', '["facebook","instagram","youtube","linkedin"]', true)
ON CONFLICT (name) DO NOTHING;
