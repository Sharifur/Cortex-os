CREATE TABLE linkedin_dm_sequences (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text,
  steps jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW()
);

ALTER TABLE linkedin_leads
  ADD COLUMN dm_step integer NOT NULL DEFAULT 0,
  ADD COLUMN dm_sequence_id text REFERENCES linkedin_dm_sequences(id);
