-- Add columns to shops table for esthe-ranking credentials
ALTER TABLE shops ADD COLUMN IF NOT EXISTS esthe_ranking_login_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS esthe_ranking_password TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS esthe_ranking_shop_url TEXT;

-- Add column to therapists table for esthe-ranking ID
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS esthe_ranking_therapist_id TEXT;
