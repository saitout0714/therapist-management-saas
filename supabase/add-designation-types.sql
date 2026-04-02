-- ============================================================
-- 指名種別マスタ + 予約連動改修 マイグレーション
-- ============================================================

-- ============================================================
-- 0. 旧チェック制約の削除（designation_type は動的マスタ管理に移行）
-- ============================================================
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_designation_type_check;

-- ============================================================
-- 1. designation_types テーブル（店舗別・指名種別マスタ）
-- ============================================================
CREATE TABLE IF NOT EXISTS designation_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,           -- 'free', 'first_nomination', 'confirmed' etc.
  display_name  TEXT NOT NULL,           -- 'フリー', '初回指名', '本指名' etc.
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  -- 姫予約のような特殊ルール
  is_store_paid_back BOOLEAN DEFAULT false,  -- 店負担バック（姫予約用）
  treats_as_confirmed BOOLEAN DEFAULT false, -- 本指名扱い（姫予約用）
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, slug)
);

ALTER TABLE designation_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access designation_types" ON designation_types FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_designation_types_shop_id ON designation_types(shop_id);

-- ============================================================
-- 2. reservations テーブルにバック計算結果保存用カラム追加
-- ============================================================
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS designation_type_id UUID REFERENCES designation_types(id) ON DELETE SET NULL;
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS therapist_back_amount INTEGER DEFAULT NULL;
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS shop_revenue INTEGER DEFAULT NULL;
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS back_calculated_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS business_date DATE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_designation_type_id ON reservations(designation_type_id);
CREATE INDEX IF NOT EXISTS idx_reservations_business_date ON reservations(business_date);

-- ============================================================
-- 3. SPA RICH 用の指名種別シードデータ
-- ============================================================
INSERT INTO designation_types (shop_id, slug, display_name, display_order, is_store_paid_back, treats_as_confirmed) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'free',              'フリー',     1, false, false),
  ('a0000001-0000-0000-0000-000000000001', 'first_nomination',  '初回指名',   2, false, false),
  ('a0000001-0000-0000-0000-000000000001', 'confirmed',         '本指名',     3, false, false),
  ('a0000001-0000-0000-0000-000000000001', 'princess',          '姫予約',     4, true,  true)
ON CONFLICT (shop_id, slug) DO NOTHING;

-- モーメント
INSERT INTO designation_types (shop_id, slug, display_name, display_order) VALUES
  ('a0000001-0000-0000-0000-000000000002', 'free',              'フリー',     1),
  ('a0000001-0000-0000-0000-000000000002', 'first_nomination',  '初回指名',   2),
  ('a0000001-0000-0000-0000-000000000002', 'confirmed',         '本指名',     3)
ON CONFLICT (shop_id, slug) DO NOTHING;

-- ラビ立川
INSERT INTO designation_types (shop_id, slug, display_name, display_order) VALUES
  ('a0000001-0000-0000-0000-000000000003', 'free',              'フリー',     1),
  ('a0000001-0000-0000-0000-000000000003', 'first_nomination',  '初回指名',   2),
  ('a0000001-0000-0000-0000-000000000003', 'confirmed',         '本指名',     3)
ON CONFLICT (shop_id, slug) DO NOTHING;

-- 大山
INSERT INTO designation_types (shop_id, slug, display_name, display_order) VALUES
  ('a0000001-0000-0000-0000-000000000004', 'free',              'フリー',     1),
  ('a0000001-0000-0000-0000-000000000004', 'first_nomination',  '初回指名',   2),
  ('a0000001-0000-0000-0000-000000000004', 'confirmed',         '本指名',     3)
ON CONFLICT (shop_id, slug) DO NOTHING;

-- 三ツ星
INSERT INTO designation_types (shop_id, slug, display_name, display_order) VALUES
  ('a0000001-0000-0000-0000-000000000005', 'free',              'フリー',     1),
  ('a0000001-0000-0000-0000-000000000005', 'first_nomination',  '初回指名',   2),
  ('a0000001-0000-0000-0000-000000000005', 'confirmed',         '本指名',     3)
ON CONFLICT (shop_id, slug) DO NOTHING;


-- ============================================================
-- 4. SPA RICH 用 割引ポリシー追加
-- ============================================================
INSERT INTO discount_policies (shop_id, name, discount_type, discount_value, burden_type, is_combinable, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000001', '新規割引',   'fixed', 2000, 'shop_only', false, true),
  ('a0000001-0000-0000-0000-000000000001', '平日昼割（12:00〜19:00入店）', 'fixed', 3000, 'shop_only', true, true)
ON CONFLICT DO NOTHING;
