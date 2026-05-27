CREATE TABLE IF NOT EXISTS taskip_trial_sequences (
  id TEXT PRIMARY KEY,
  workspace_uuid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  industry TEXT,
  step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  gmail_account_id TEXT,
  sent_angles JSONB NOT NULL DEFAULT '[]'::jsonb,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_step_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_step_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS taskip_trial_seq_workspace ON taskip_trial_sequences(workspace_uuid);
CREATE INDEX IF NOT EXISTS taskip_trial_seq_due ON taskip_trial_sequences(status, next_step_at);
