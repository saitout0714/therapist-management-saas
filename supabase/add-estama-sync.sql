-- Add columns to shops table for estama credentials
ALTER TABLE shops ADD COLUMN IF NOT EXISTS estama_login_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS estama_password TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS estama_shop_url TEXT DEFAULT 'https://estama.jp/login/?r=/admin/';

-- Add column to therapists table for estama ID
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS estama_therapist_id TEXT;
