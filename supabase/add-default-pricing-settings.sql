-- 料金デフォルト設定テーブル
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  default_nomination_fee INTEGER DEFAULT 0,
  default_confirmed_nomination_fee INTEGER DEFAULT 0,
  default_princess_reservation_fee INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- セラピスト個別料金に姫予約料金を追加
ALTER TABLE therapist_pricing ADD COLUMN IF NOT EXISTS princess_reservation_fee INTEGER DEFAULT 0;
