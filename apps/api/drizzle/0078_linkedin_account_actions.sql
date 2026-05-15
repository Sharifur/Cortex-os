ALTER TABLE linkedin_accounts ADD COLUMN enable_connections boolean NOT NULL DEFAULT true;
ALTER TABLE linkedin_accounts ADD COLUMN enable_comments boolean NOT NULL DEFAULT true;
ALTER TABLE linkedin_accounts ADD COLUMN enable_dms boolean NOT NULL DEFAULT true;
ALTER TABLE linkedin_accounts ADD COLUMN max_connections_per_run integer;
ALTER TABLE linkedin_accounts ADD COLUMN max_dms_per_run integer;
ALTER TABLE linkedin_accounts ADD COLUMN max_comments_per_run integer;
