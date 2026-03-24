-- ============================================================
-- 報酬（バック）計算システム — マイグレーション
-- ============================================================
-- このマイグレーションは以下を作成・変更する:
--   新規テーブル (9):
--     shop_back_rules, course_back_amounts, rank_back_rules,
--     therapist_back_overrides, option_back_rules,
--     discount_policies, reservation_discounts, deduction_rules,
--     payroll_entries, reservation_change_log
--   既存テーブル変更 (3):
--     therapists, reservations, reservation_options
-- ============================================================

-- ============================================================
-- 1. 既存テーブルへのカラム追加
-- ============================================================

-- 1a. therapists — セラピスト個別のバック計算方式
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS back_calc_type TEXT DEFAULT NULL
    CHECK (back_calc_type IN ('percentage', 'fixed', 'half_split'));
-- NULL = 個人別設定なし（shop/rank のルールに従う）
-- 'half_split' = 総売上折半タイプ

-- 1b. reservations — バック計算結果 & 変更追跡
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS therapist_back_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shop_revenue INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS back_calculated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS business_date DATE,
  ADD COLUMN IF NOT EXISTS original_therapist_id UUID
    REFERENCES therapists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_designation_type TEXT,
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- 1c. reservation_options — 途中追加の識別
ALTER TABLE reservation_options
  ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_mid_session BOOLEAN DEFAULT false;


-- ============================================================
-- 2. shop_back_rules — 店舗レベルのバック基本設定
-- ============================================================
CREATE TABLE IF NOT EXISTS shop_back_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,

  -- コース料金に対するバック方式
  course_calc_type   TEXT NOT NULL DEFAULT 'percentage'
    CHECK (course_calc_type IN ('percentage', 'fixed')),
  course_back_rate   NUMERIC(5,2) DEFAULT 50.00,

  -- オプションに対するバック方式
  option_calc_type   TEXT NOT NULL DEFAULT 'full_back'
    CHECK (option_calc_type IN ('full_back', 'percentage', 'fixed', 'per_item')),
  option_back_rate   NUMERIC(5,2) DEFAULT 100.00,

  -- 指名料に対するバック方式
  nomination_calc_type TEXT NOT NULL DEFAULT 'full_back'
    CHECK (nomination_calc_type IN ('full_back', 'percentage', 'fixed')),
  nomination_back_rate NUMERIC(5,2) DEFAULT 100.00,

  -- 端数処理
  rounding_method    TEXT NOT NULL DEFAULT 'floor'
    CHECK (rounding_method IN ('floor', 'ceil', 'round')),

  -- 営業日の切り替え時刻
  business_day_cutoff TIME NOT NULL DEFAULT '06:00',

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id)
);


-- ============================================================
-- 3. course_back_amounts — コース×ランク×指名種別の固定額バック表
-- ============================================================
CREATE TABLE IF NOT EXISTS course_back_amounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rank_id          UUID REFERENCES therapist_ranks(id) ON DELETE CASCADE,
  designation_type TEXT NOT NULL DEFAULT 'free'
    CHECK (designation_type IN (
      'free', 'first_nomination', 'confirmed',
      'photo', 'princess', 'certified'
    )),
  back_amount      INTEGER NOT NULL,
  customer_price   INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, course_id, rank_id, designation_type)
);


-- ============================================================
-- 4. rank_back_rules — ランク別バック率オーバーライド
-- ============================================================
CREATE TABLE IF NOT EXISTS rank_back_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  rank_id        UUID NOT NULL REFERENCES therapist_ranks(id) ON DELETE CASCADE,
  course_back_rate   NUMERIC(5,2),
  option_back_rate   NUMERIC(5,2),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, rank_id)
);


-- ============================================================
-- 5. therapist_back_overrides — セラピスト個別バック率
-- ============================================================
CREATE TABLE IF NOT EXISTS therapist_back_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id    UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  course_back_rate    NUMERIC(5,2),
  option_back_rate    NUMERIC(5,2),
  nomination_back_rate NUMERIC(5,2),
  course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(therapist_id, course_id)
);


-- ============================================================
-- 6. option_back_rules — オプション個別バック設定
-- ============================================================
CREATE TABLE IF NOT EXISTS option_back_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  option_id     UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  calc_type     TEXT NOT NULL DEFAULT 'percentage'
    CHECK (calc_type IN ('full_back', 'percentage', 'fixed')),
  back_rate     NUMERIC(5,2),
  back_amount   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, option_id)
);


-- ============================================================
-- 7. discount_policies — 割引負担ルール
-- ============================================================
CREATE TABLE IF NOT EXISTS discount_policies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  discount_type    TEXT NOT NULL DEFAULT 'fixed'
    CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value   INTEGER NOT NULL,
  burden_type      TEXT NOT NULL DEFAULT 'shop_only'
    CHECK (burden_type IN ('shop_only', 'split', 'therapist_only')),
  is_combinable    BOOLEAN DEFAULT false,
  max_per_reservation INTEGER DEFAULT 1,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 8. reservation_discounts — 予約に適用された割引の記録
-- ============================================================
CREATE TABLE IF NOT EXISTS reservation_discounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  policy_id       UUID REFERENCES discount_policies(id),
    -- NULL = アドホック割引（マスタ外）
  applied_amount  INTEGER NOT NULL,
  burden_type     TEXT NOT NULL,
  -- アドホック割引用カラム
  is_adhoc        BOOLEAN DEFAULT false,
  adhoc_name      TEXT,
  approved_by     UUID,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 9. deduction_rules — 控除・手当マスタ
-- ============================================================
CREATE TABLE IF NOT EXISTS deduction_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'deduction'
    CHECK (category IN ('deduction', 'allowance', 'penalty')),
  calc_timing   TEXT NOT NULL DEFAULT 'per_reservation'
    CHECK (calc_timing IN ('per_reservation', 'per_shift', 'monthly')),
  amount        INTEGER NOT NULL,
  min_duration  INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 10. payroll_entries — 日次報酬明細
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  therapist_id    UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  business_date   DATE NOT NULL,
  total_sales           INTEGER DEFAULT 0,
  total_back            INTEGER DEFAULT 0,
  total_deductions      INTEGER DEFAULT 0,
  total_allowances      INTEGER DEFAULT 0,
  net_pay               INTEGER DEFAULT 0,
  reservation_count     INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'paid')),
  confirmed_by    UUID,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, therapist_id, business_date)
);


-- ============================================================
-- 11. reservation_change_log — 予約変更履歴
-- ============================================================
CREATE TABLE IF NOT EXISTS reservation_change_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  changed_at      TIMESTAMPTZ DEFAULT NOW(),
  changed_by      UUID,
  field_name      TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  reason          TEXT
);


-- ============================================================
-- 12. RLS有効化
-- ============================================================
ALTER TABLE shop_back_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_back_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_back_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_back_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_back_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deduction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_change_log ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 13. RLSポリシー（全テーブル共通: 全アクセス許可）
-- ============================================================
-- 現行のアプリは独自認証のため anon ロールで動作。
-- Supabase Auth 統合時にポリシーを制限する。
CREATE POLICY "Users can access shop_back_rules" ON shop_back_rules FOR ALL USING (true);
CREATE POLICY "Users can access course_back_amounts" ON course_back_amounts FOR ALL USING (true);
CREATE POLICY "Users can access rank_back_rules" ON rank_back_rules FOR ALL USING (true);
CREATE POLICY "Users can access therapist_back_overrides" ON therapist_back_overrides FOR ALL USING (true);
CREATE POLICY "Users can access option_back_rules" ON option_back_rules FOR ALL USING (true);
CREATE POLICY "Users can access discount_policies" ON discount_policies FOR ALL USING (true);
CREATE POLICY "Users can access reservation_discounts" ON reservation_discounts FOR ALL USING (true);
CREATE POLICY "Users can access deduction_rules" ON deduction_rules FOR ALL USING (true);
CREATE POLICY "Users can access payroll_entries" ON payroll_entries FOR ALL USING (true);
CREATE POLICY "Users can access reservation_change_log" ON reservation_change_log FOR ALL USING (true);


-- ============================================================
-- 14. インデックス
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shop_back_rules_shop_id ON shop_back_rules(shop_id);
CREATE INDEX IF NOT EXISTS idx_course_back_amounts_shop_id ON course_back_amounts(shop_id);
CREATE INDEX IF NOT EXISTS idx_course_back_amounts_course_id ON course_back_amounts(course_id);
CREATE INDEX IF NOT EXISTS idx_course_back_amounts_rank_id ON course_back_amounts(rank_id);
CREATE INDEX IF NOT EXISTS idx_rank_back_rules_shop_id ON rank_back_rules(shop_id);
CREATE INDEX IF NOT EXISTS idx_rank_back_rules_rank_id ON rank_back_rules(rank_id);
CREATE INDEX IF NOT EXISTS idx_therapist_back_overrides_therapist_id ON therapist_back_overrides(therapist_id);
CREATE INDEX IF NOT EXISTS idx_option_back_rules_shop_id ON option_back_rules(shop_id);
CREATE INDEX IF NOT EXISTS idx_option_back_rules_option_id ON option_back_rules(option_id);
CREATE INDEX IF NOT EXISTS idx_discount_policies_shop_id ON discount_policies(shop_id);
CREATE INDEX IF NOT EXISTS idx_reservation_discounts_reservation_id ON reservation_discounts(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_discounts_policy_id ON reservation_discounts(policy_id);
CREATE INDEX IF NOT EXISTS idx_deduction_rules_shop_id ON deduction_rules(shop_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_shop_id ON payroll_entries(shop_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_therapist_id ON payroll_entries(therapist_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_business_date ON payroll_entries(business_date);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_status ON payroll_entries(status);
CREATE INDEX IF NOT EXISTS idx_reservation_change_log_reservation_id ON reservation_change_log(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservations_business_date ON reservations(business_date);
CREATE INDEX IF NOT EXISTS idx_reservations_original_therapist_id ON reservations(original_therapist_id);


-- ============================================================
-- 15. 既存店舗へのデフォルト shop_back_rules の自動挿入
-- ============================================================
-- すべてのアクティブな店舗に対して、デフォルトの50%バックルールを作成
INSERT INTO shop_back_rules (shop_id)
SELECT id FROM shops
WHERE is_active = true
ON CONFLICT (shop_id) DO NOTHING;
