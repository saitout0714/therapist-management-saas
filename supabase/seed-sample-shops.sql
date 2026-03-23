-- ============================================================
-- サンプルデータ投入 — 5店舗分の料金・バック設定
-- ============================================================
-- 店舗: SPA RICH, モーメント, ラビ立川, 大山, 三ツ星
-- ============================================================

-- ============================================================
-- 1. 店舗マスタ
-- ============================================================
INSERT INTO shops (id, name, description, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'SPA RICH',  '固定額バック方式。ランク制（シルバー/ゴールド/プラチナ）。厚生費800円天引き。', true),
  ('a0000001-0000-0000-0000-000000000002', 'モーメント', '個人別バック率方式。セラピストごとに50%〜70%。割引は店落ちから引く。', true),
  ('a0000001-0000-0000-0000-000000000003', 'ラビ立川',   '固定額＋OP個別方式。折半セラピストも在籍。', true),
  ('a0000001-0000-0000-0000-000000000004', '大山',       '基本50%＋OPフルバック方式。シンプルな折半制。', true),
  ('a0000001-0000-0000-0000-000000000005', '三ツ星',     '基本50%。割引時はセラピストも負担（折半）。', true)
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- 2. セラピストランクマスタ（SPA RICH用）
-- ============================================================
INSERT INTO therapist_ranks (id, shop_id, name, display_order) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'シルバー',       1),
  ('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'ゴールド',       2),
  ('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', 'プラチナ（認定）', 3)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 3. コースマスタ（店舗ごと）
-- ============================================================

-- ■ SPA RICH
INSERT INTO courses (id, shop_id, name, duration, base_price, is_active, display_order) VALUES
  ('c0000001-0001-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'コミ60分',  60, 16000, true, 1),
  ('c0000001-0001-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'コミ90分',  90, 22000, true, 2),
  ('c0000001-0001-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', '延長30分',  30,  6000, true, 3)
ON CONFLICT DO NOTHING;

-- ■ モーメント
INSERT INTO courses (id, shop_id, name, duration, base_price, is_active, display_order) VALUES
  ('c0000002-0001-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000002', '60分コース',  60, 15000, true, 1),
  ('c0000002-0001-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', '90分コース',  90, 20000, true, 2),
  ('c0000002-0001-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000002', '100分特別',  100, 35000, true, 3),
  ('c0000002-0001-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000002', '120分コース',120, 25000, true, 4),
  ('c0000002-0001-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000002', '延長30分',    30,  6000, true, 5)
ON CONFLICT DO NOTHING;

-- ■ ラビ立川
INSERT INTO courses (id, shop_id, name, duration, base_price, is_active, display_order) VALUES
  ('c0000003-0001-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000003', '60分コース',   60, 15000, true, 1),
  ('c0000003-0001-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000003', '90分コース',   90, 18000, true, 2),
  ('c0000003-0001-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000003', '120分コース', 120, 23000, true, 3),
  ('c0000003-0001-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000003', '150分コース', 150, 27000, true, 4),
  ('c0000003-0001-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000003', '延長30分',     30,  6000, true, 5)
ON CONFLICT DO NOTHING;

-- ■ 大山
INSERT INTO courses (id, shop_id, name, duration, base_price, is_active, display_order) VALUES
  ('c0000004-0001-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000004', '60分コース',   60, 11000, true, 1),
  ('c0000004-0001-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000004', '90分コース',   90, 14000, true, 2),
  ('c0000004-0001-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000004', '120分コース', 120, 18000, true, 3),
  ('c0000004-0001-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000004', '延長30分',     30,  6000, true, 4)
ON CONFLICT DO NOTHING;

-- ■ 三ツ星
INSERT INTO courses (id, shop_id, name, duration, base_price, is_active, display_order) VALUES
  ('c0000005-0001-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000005', '60分コース',   60, 13000, true, 1),
  ('c0000005-0001-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000005', '90分コース',   90, 17000, true, 2),
  ('c0000005-0001-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000005', '120分コース', 120, 21000, true, 3),
  ('c0000005-0001-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000005', '延長30分',     30,  6000, true, 4)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 4. オプションマスタ
-- ============================================================

-- ■ SPA RICH（OPフルバック）
INSERT INTO options (id, shop_id, name, price, is_active, display_order) VALUES
  ('d0000001-0001-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', '衣装チェンジ',  2000, true, 1),
  ('d0000001-0001-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', '極泡',         2000, true, 2),
  ('d0000001-0001-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', 'ホイップ',     2000, true, 3)
ON CONFLICT DO NOTHING;

-- ■ ラビ立川（OP個別バック率）
INSERT INTO options (id, shop_id, name, price, is_active, display_order) VALUES
  ('d0000003-0001-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000003', 'パウダー',       1000, true, 1),
  ('d0000003-0001-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000003', 'ホイップ',       2000, true, 2),
  ('d0000003-0001-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000003', '衣装（3000円）', 3000, true, 3),
  ('d0000003-0001-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000003', '衣装（5000円）', 5000, true, 4)
ON CONFLICT DO NOTHING;

-- ■ 大山（OPフルバック）
INSERT INTO options (id, shop_id, name, price, is_active, display_order) VALUES
  ('d0000004-0001-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000004', '衣装チェンジ',   2000, true, 1),
  ('d0000004-0001-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000004', 'ホイップ',       2000, true, 2),
  ('d0000004-0001-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000004', 'ディープリンパ', 3000, true, 3)
ON CONFLICT DO NOTHING;

-- ■ モーメント（OPフルバック）
INSERT INTO options (id, shop_id, name, price, is_active, display_order) VALUES
  ('d0000002-0001-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000002', '衣装チェンジ',  2000, true, 1),
  ('d0000002-0001-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', '極泡',         2000, true, 2),
  ('d0000002-0001-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000002', 'ホイップ',     2000, true, 3)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 5. shop_back_rules（バック計算方式）
-- ============================================================

-- ■ SPA RICH: 固定額方式, OPフルバック, 指名料フルバック
INSERT INTO shop_back_rules (shop_id, course_calc_type, course_back_rate, option_calc_type, option_back_rate, nomination_calc_type, nomination_back_rate, rounding_method, business_day_cutoff) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'fixed', 0, 'full_back', 100, 'full_back', 100, 'floor', '06:00')
ON CONFLICT (shop_id) DO UPDATE SET
  course_calc_type = EXCLUDED.course_calc_type,
  course_back_rate = EXCLUDED.course_back_rate,
  option_calc_type = EXCLUDED.option_calc_type,
  option_back_rate = EXCLUDED.option_back_rate,
  nomination_calc_type = EXCLUDED.nomination_calc_type,
  nomination_back_rate = EXCLUDED.nomination_back_rate;

-- ■ モーメント: 50%バック（個人別にオーバーライド）, OPフルバック, 指名料フルバック
INSERT INTO shop_back_rules (shop_id, course_calc_type, course_back_rate, option_calc_type, option_back_rate, nomination_calc_type, nomination_back_rate, rounding_method, business_day_cutoff) VALUES
  ('a0000001-0000-0000-0000-000000000002', 'percentage', 50, 'full_back', 100, 'full_back', 100, 'floor', '06:00')
ON CONFLICT (shop_id) DO UPDATE SET
  course_calc_type = EXCLUDED.course_calc_type,
  course_back_rate = EXCLUDED.course_back_rate,
  option_calc_type = EXCLUDED.option_calc_type,
  nomination_calc_type = EXCLUDED.nomination_calc_type;

-- ■ ラビ立川: 固定額方式, OP個別設定
INSERT INTO shop_back_rules (shop_id, course_calc_type, course_back_rate, option_calc_type, option_back_rate, nomination_calc_type, nomination_back_rate, rounding_method, business_day_cutoff) VALUES
  ('a0000001-0000-0000-0000-000000000003', 'fixed', 0, 'per_item', 50, 'full_back', 100, 'floor', '06:00')
ON CONFLICT (shop_id) DO UPDATE SET
  course_calc_type = EXCLUDED.course_calc_type,
  option_calc_type = EXCLUDED.option_calc_type,
  option_back_rate = EXCLUDED.option_back_rate,
  nomination_calc_type = EXCLUDED.nomination_calc_type;

-- ■ 大山: 50%バック, OPフルバック, 指名料フルバック
INSERT INTO shop_back_rules (shop_id, course_calc_type, course_back_rate, option_calc_type, option_back_rate, nomination_calc_type, nomination_back_rate, rounding_method, business_day_cutoff) VALUES
  ('a0000001-0000-0000-0000-000000000004', 'percentage', 50, 'full_back', 100, 'full_back', 100, 'floor', '06:00')
ON CONFLICT (shop_id) DO UPDATE SET
  course_calc_type = EXCLUDED.course_calc_type,
  course_back_rate = EXCLUDED.course_back_rate,
  option_calc_type = EXCLUDED.option_calc_type,
  nomination_calc_type = EXCLUDED.nomination_calc_type;

-- ■ 三ツ星: 50%バック, OPフルバック, 指名料フルバック
INSERT INTO shop_back_rules (shop_id, course_calc_type, course_back_rate, option_calc_type, option_back_rate, nomination_calc_type, nomination_back_rate, rounding_method, business_day_cutoff) VALUES
  ('a0000001-0000-0000-0000-000000000005', 'percentage', 50, 'full_back', 100, 'full_back', 100, 'floor', '06:00')
ON CONFLICT (shop_id) DO UPDATE SET
  course_calc_type = EXCLUDED.course_calc_type,
  course_back_rate = EXCLUDED.course_back_rate,
  option_calc_type = EXCLUDED.option_calc_type,
  nomination_calc_type = EXCLUDED.nomination_calc_type;


-- ============================================================
-- 6. course_back_amounts（SPA RICH 固定額バック表）
-- ============================================================

-- ■ SPA RICH: コミ60分 × ランク × 指名種別
-- シルバー × コミ60分
INSERT INTO course_back_amounts (shop_id, course_id, rank_id, designation_type, back_amount, customer_price) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'free',              6700,  16000),
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'first_nomination',  7200,  16000),
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'confirmed',         7700,  16000)
ON CONFLICT DO NOTHING;

-- ゴールド × コミ60分
INSERT INTO course_back_amounts (shop_id, course_id, rank_id, designation_type, back_amount, customer_price) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000002', 'free',              7200,  16000),
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000002', 'first_nomination',  7700,  16000),
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000002', 'confirmed',         8200,  16000)
ON CONFLICT DO NOTHING;

-- プラチナ（認定） × コミ60分
INSERT INTO course_back_amounts (shop_id, course_id, rank_id, designation_type, back_amount, customer_price) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000003', 'free',              7700,  16000),
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000003', 'first_nomination',  8700,  17000),
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000003', 'confirmed',         9700,  17000)
ON CONFLICT DO NOTHING;

-- 全ランク共通 × 延長30分
INSERT INTO course_back_amounts (shop_id, course_id, rank_id, designation_type, back_amount, customer_price) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000001', 'free', 3000, 6000),
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000002', 'free', 3200, 6000),
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0001-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000003', 'free', 3400, 6000)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 7. course_back_amounts（ラビ立川 固定額バック表）
-- ============================================================
INSERT INTO course_back_amounts (shop_id, course_id, rank_id, designation_type, back_amount, customer_price) VALUES
  ('a0000001-0000-0000-0000-000000000003', 'c0000003-0001-0000-0000-000000000001', NULL, 'free',  8000, 15000),
  ('a0000001-0000-0000-0000-000000000003', 'c0000003-0001-0000-0000-000000000002', NULL, 'free', 10000, 18000),
  ('a0000001-0000-0000-0000-000000000003', 'c0000003-0001-0000-0000-000000000003', NULL, 'free', 13000, 23000),
  ('a0000001-0000-0000-0000-000000000003', 'c0000003-0001-0000-0000-000000000004', NULL, 'free', 15000, 27000),
  ('a0000001-0000-0000-0000-000000000003', 'c0000003-0001-0000-0000-000000000005', NULL, 'free',  3000,  6000)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 8. option_back_rules（ラビ立川 OP個別バック設定）
-- ============================================================
INSERT INTO option_back_rules (shop_id, option_id, calc_type, back_rate, back_amount) VALUES
  ('a0000001-0000-0000-0000-000000000003', 'd0000003-0001-0000-0000-000000000001', 'percentage', 50,   NULL),  -- パウダー: 50%
  ('a0000001-0000-0000-0000-000000000003', 'd0000003-0001-0000-0000-000000000002', 'percentage', 50,   NULL),  -- ホイップ: 50%
  ('a0000001-0000-0000-0000-000000000003', 'd0000003-0001-0000-0000-000000000003', 'percentage', 50,   NULL),  -- 衣装3000: 50%
  ('a0000001-0000-0000-0000-000000000003', 'd0000003-0001-0000-0000-000000000004', 'percentage', 60,   NULL)   -- 衣装5000: 60%
ON CONFLICT DO NOTHING;


-- ============================================================
-- 9. セラピストサンプル（モーメント — 個人別バック率）
-- ============================================================
INSERT INTO therapists (id, shop_id, name) VALUES
  ('e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000002', 'あや'),
  ('e0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', 'るか'),
  ('e0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000002', 'えま'),
  ('e0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000002', 'まい'),
  ('e0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000002', 'ひめか')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 10. therapist_back_overrides（モーメント — 個人別バック率）
-- ============================================================
-- あや: 全コース70%
INSERT INTO therapist_back_overrides (therapist_id, course_back_rate, option_back_rate, nomination_back_rate, course_id) VALUES
  ('e0000001-0000-0000-0000-000000000001', 70, NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- るか / えま / まい: 全コース60%
INSERT INTO therapist_back_overrides (therapist_id, course_back_rate, option_back_rate, nomination_back_rate, course_id) VALUES
  ('e0000001-0000-0000-0000-000000000002', 60, NULL, NULL, NULL),
  ('e0000001-0000-0000-0000-000000000003', 60, NULL, NULL, NULL),
  ('e0000001-0000-0000-0000-000000000004', 60, NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ひめか: 特別コース100分のみ約80%バック（店落ち6800円 → 35000-6800=28200 → 28200/35000≒80.57%）
INSERT INTO therapist_back_overrides (therapist_id, course_back_rate, option_back_rate, nomination_back_rate, course_id) VALUES
  ('e0000001-0000-0000-0000-000000000005', 80.57, NULL, NULL, 'c0000002-0001-0000-0000-000000000003')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 11. discount_policies（割引設定）
-- ============================================================

-- ■ モーメント: 割引は店落ちから引く
INSERT INTO discount_policies (shop_id, name, discount_type, discount_value, burden_type, is_combinable, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000002', '新規割引',     'fixed', 1000, 'shop_only', false, true),
  ('a0000001-0000-0000-0000-000000000002', '事前予約割引', 'fixed', 1000, 'shop_only', false, true)
ON CONFLICT DO NOTHING;

-- ■ ラビ立川: 割引は店負担
INSERT INTO discount_policies (shop_id, name, discount_type, discount_value, burden_type, is_combinable, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000003', '新規割引',     'fixed', 1000, 'shop_only', false, true)
ON CONFLICT DO NOTHING;

-- ■ 三ツ星: 割引はセラピストも負担（折半）
INSERT INTO discount_policies (shop_id, name, discount_type, discount_value, burden_type, is_combinable, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000005', '新規割引',     'fixed', 2000, 'split', false, true),
  ('a0000001-0000-0000-0000-000000000005', '初回指名割引', 'fixed', 1000, 'split', false, true)
ON CONFLICT DO NOTHING;

-- ■ 大山: 割引ルールなし（割引自体あまり行わない）


-- ============================================================
-- 12. deduction_rules（控除・手当）
-- ============================================================

-- ■ SPA RICH: 厚生費800円/本、交通費2000円/出勤
INSERT INTO deduction_rules (shop_id, name, category, calc_timing, amount, min_duration, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000001', '厚生費',   'deduction',  'per_reservation', 800, 0, true),
  ('a0000001-0000-0000-0000-000000000001', '交通費',   'allowance',  'per_shift',      2000, 0, true)
ON CONFLICT DO NOTHING;

-- ■ モーメント: 当欠罰金（月次）
INSERT INTO deduction_rules (shop_id, name, category, calc_timing, amount, min_duration, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000002', '当欠罰金', 'penalty', 'monthly', 5000, 0, true)
ON CONFLICT DO NOTHING;

-- ■ 大山: 特になし（シンプル折半）

-- ■ ラビ立川: ルーム使用料免除（記録のため0円の控除として）
-- ※ 実際には免除なので、必要に応じてマスタから設定

-- ■ 三ツ星: 特になし


-- ============================================================
-- 13. 既存の shop_owners に紐づけ (admin ユーザーに全店舗アクセス権)
-- ============================================================
-- 既存のadminユーザーIDを取得して、全店舗に紐づける
INSERT INTO shop_owners (shop_id, user_id)
SELECT s.id, u.id
FROM users u, shops s
WHERE u.email = 'admin@example.com'
  AND s.id IN (
    'a0000001-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000003',
    'a0000001-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000005'
  )
ON CONFLICT DO NOTHING;
