-- オプションのバックカテゴリ（衣装/その他など）を options テーブルに追加
ALTER TABLE options ADD COLUMN IF NOT EXISTS back_category TEXT NOT NULL DEFAULT 'その他';

-- セラピスト別オプションバック設定テーブル
-- option_category NULL = 全カテゴリ共通, designation_type NULL = 全指名種別共通
CREATE TABLE IF NOT EXISTS therapist_option_backs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL,
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  option_category TEXT,     -- NULL = 全カテゴリ共通（その他も含む）
  designation_type TEXT,    -- NULL = 全指名種別共通
  back_rate NUMERIC(5,4) NOT NULL CHECK (back_rate >= 0 AND back_rate <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(therapist_id, option_category, designation_type)
);

CREATE INDEX IF NOT EXISTS idx_therapist_option_backs_therapist ON therapist_option_backs(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_option_backs_shop ON therapist_option_backs(shop_id);
