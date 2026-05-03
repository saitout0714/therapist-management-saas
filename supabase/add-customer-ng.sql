-- 顧客ステータス・NG理由フィールド追加
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '予約可';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ng_reason TEXT;

-- 顧客×セラピスト NGペアテーブル
CREATE TABLE IF NOT EXISTS customer_therapist_ng (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, therapist_id)
);
