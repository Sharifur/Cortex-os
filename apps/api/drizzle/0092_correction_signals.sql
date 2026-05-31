CREATE TABLE IF NOT EXISTS correction_signals (
  id TEXT PRIMARY KEY,
  agent_key TEXT NOT NULL,
  run_id TEXT,
  approval_id TEXT,
  signal_type TEXT NOT NULL,
  latency_ms INTEGER,
  followup_count INTEGER NOT NULL DEFAULT 0,
  draft_text TEXT,
  correction_text TEXT,
  rejection_reason TEXT,
  rating TEXT,
  action_type TEXT,
  payload JSONB,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cs_agent_key_idx ON correction_signals(agent_key);
CREATE INDEX IF NOT EXISTS cs_signal_type_idx ON correction_signals(agent_key, signal_type, captured_at);
