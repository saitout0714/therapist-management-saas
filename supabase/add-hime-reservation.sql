-- 姫予約フィールドをreservationsテーブルに追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_hime BOOLEAN DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS hime_type TEXT CHECK (hime_type IN ('first_nomination', 'nomination'));
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS hime_bonus INTEGER DEFAULT 0;
