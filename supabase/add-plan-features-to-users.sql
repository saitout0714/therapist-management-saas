-- users テーブルにプランと3機能フラグを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan text DEFAULT 'hp_web_agency_plan';
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_hp boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_reserve boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_agency boolean DEFAULT true;

-- shops テーブルにも念のため追加
ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan text DEFAULT 'hp_web_agency_plan';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS has_hp boolean DEFAULT true;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS has_reserve boolean DEFAULT true;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS has_agency boolean DEFAULT true;
