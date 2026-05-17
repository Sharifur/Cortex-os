ALTER TABLE taskip_internal_emails
  ADD COLUMN IF NOT EXISTS gmail_account_id text;
