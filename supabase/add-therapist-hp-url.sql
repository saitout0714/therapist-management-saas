-- Add HP URL column to therapists table for schedule scraping
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS hp_url TEXT;
