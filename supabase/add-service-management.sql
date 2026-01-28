-- サービス管理テーブル（コース、オプション、料金）

-- コースマスタ（施術メニュー）
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID,
  name TEXT NOT NULL,  -- 例: "60分コース", "90分コース"
  duration INTEGER NOT NULL,  -- 施術時間（分）
  base_price INTEGER NOT NULL,  -- 基本料金
  description TEXT,
  is_active BOOLEAN DEFAULT true,  -- 有効/無効
  display_order INTEGER DEFAULT 0,  -- 表示順
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- オプションマスタ
CREATE TABLE options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID,
  name TEXT NOT NULL,  -- 例: "延長30分", "ヘッドマッサージ"
  duration INTEGER DEFAULT 0,  -- 追加時間（分）
  price INTEGER NOT NULL,  -- オプション料金
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- セラピスト別料金設定（指名料など）
CREATE TABLE therapist_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
  nomination_fee INTEGER DEFAULT 0,  -- 指名料
  is_nomination_required BOOLEAN DEFAULT false,  -- 指名必須かどうか
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(therapist_id)
);

-- 予約テーブルの拡張（既存のreservationsテーブルを修正）
-- まず既存のreservationsテーブルに新しいカラムを追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS total_price INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS base_price INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nomination_fee INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS options_price INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS notes TEXT;

-- 予約オプション中間テーブル（予約に紐づくオプション）
CREATE TABLE reservation_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  option_id UUID REFERENCES options(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,  -- 数量（必要に応じて）
  price INTEGER NOT NULL,  -- 適用時の価格（価格変更に対応）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(reservation_id, option_id)
);

-- RLS有効化
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_options ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（一旦全て許可）
CREATE POLICY "Users can access courses" ON courses FOR ALL USING (true);
CREATE POLICY "Users can access options" ON options FOR ALL USING (true);
CREATE POLICY "Users can access therapist_pricing" ON therapist_pricing FOR ALL USING (true);
CREATE POLICY "Users can access reservation_options" ON reservation_options FOR ALL USING (true);

-- インデックス
CREATE INDEX idx_courses_store_id ON courses(store_id);
CREATE INDEX idx_courses_is_active ON courses(is_active);
CREATE INDEX idx_options_store_id ON options(store_id);
CREATE INDEX idx_options_is_active ON options(is_active);
CREATE INDEX idx_therapist_pricing_therapist_id ON therapist_pricing(therapist_id);
CREATE INDEX idx_reservation_options_reservation_id ON reservation_options(reservation_id);
CREATE INDEX idx_reservation_options_option_id ON reservation_options(option_id);
CREATE INDEX idx_reservations_course_id ON reservations(course_id);
CREATE INDEX idx_reservations_room_id ON reservations(room_id);

-- サンプルデータ挿入用のコメント
-- INSERT INTO courses (store_id, name, duration, base_price, description, display_order) VALUES
-- (NULL, '60分コース', 60, 6000, 'スタンダードな60分の施術コース', 1),
-- (NULL, '90分コース', 90, 9000, 'じっくり90分の施術コース', 2),
-- (NULL, '120分コース', 120, 12000, 'たっぷり120分の施術コース', 3);

-- INSERT INTO options (store_id, name, duration, price, description, display_order) VALUES
-- (NULL, '延長30分', 30, 3000, '施術時間を30分延長', 1),
-- (NULL, 'ヘッドマッサージ', 15, 1500, '頭部の集中ケア', 2),
-- (NULL, 'フットケア', 20, 2000, '足裏の集中ケア', 3);
