-- セラピストの在籍状況カラム追加
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_therapists_is_active ON therapists(shop_id, is_active);
