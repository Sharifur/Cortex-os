-- Store the drafted outreach subject + body on the prospect row
ALTER TABLE listing_prospects ADD COLUMN IF NOT EXISTS outreach_subject TEXT;
ALTER TABLE listing_prospects ADD COLUMN IF NOT EXISTS outreach_body TEXT;
