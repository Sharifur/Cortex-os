ALTER TABLE support_tickets ADD COLUMN ticket_no text;
ALTER TABLE support_tickets ADD COLUMN contact_name text;
ALTER TABLE support_tickets ADD COLUMN contact_phone text;
ALTER TABLE support_tickets ADD COLUMN replied_at timestamp;
ALTER TABLE support_tickets ALTER COLUMN body DROP NOT NULL;
