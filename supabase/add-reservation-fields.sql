-- 予約テーブルへの追加カラム定義
-- 既存のreservationsテーブルに以下のカラムを追加

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS designation_type TEXT DEFAULT 'free' CHECK (designation_type IN ('free', 'nomination', 'confirmed')); -- free: フリー, nomination: 指名, confirmed: 本指名
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0; -- 割引額
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS discount_reason TEXT; -- 割引理由

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_designation_type ON reservations(designation_type);
