-- Add per-product columns; change unique from domain-only to (domain, product_domain)
ALTER TABLE listing_prospects ADD COLUMN IF NOT EXISTS product_domain TEXT NOT NULL DEFAULT '';
ALTER TABLE listing_prospects ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Drop old single-column unique constraint (Drizzle named it listing_prospects_domain_key)
ALTER TABLE listing_prospects DROP CONSTRAINT IF EXISTS listing_prospects_domain_unique;
ALTER TABLE listing_prospects DROP CONSTRAINT IF EXISTS listing_prospects_domain_key;

-- Compound unique: same directory site can be targeted for multiple products
CREATE UNIQUE INDEX IF NOT EXISTS listing_prospects_domain_product_idx
  ON listing_prospects (domain, product_domain);
