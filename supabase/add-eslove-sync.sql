-- Add columns to shops table for eslove (エステラブ) credentials
ALTER TABLE shops ADD COLUMN IF NOT EXISTS eslove_login_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS eslove_password TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS eslove_shop_url TEXT DEFAULT 'https://eslove.jp/admin/login';

-- Add column to therapists table for eslove ID
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS eslove_therapist_id TEXT;
