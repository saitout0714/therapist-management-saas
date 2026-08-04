-- ============================================================================
-- 各店舗の契約プランと機能モジュールを設定する
--
-- 作成日 : 2026-08-04
-- 適用先 : PRODUCTION
-- 方針   : SpecialGrade = HP＋Web予約 / こころリンス2店舗 = 代行＋Web予約 / 残り = 代行単体
-- 性質   : shops の plan, has_hp, has_reserve, has_agency のみ更新。他の列は触らない。
-- ============================================================================

BEGIN;

-- 1. まず全店舗を「代行単体」に揃える
UPDATE public.shops
   SET plan = 'agency_only_plan',
       has_hp = false,
       has_reserve = false,
       has_agency = true;

-- 2. こころリンス2店舗 → 代行＋Web予約
UPDATE public.shops
   SET plan = 'web_agency_plan',
       has_hp = false,
       has_reserve = true,
       has_agency = true
 WHERE name LIKE '%こころリンス%';

-- 3. SpecialGrade → HP＋Web予約（電話代行なし）
UPDATE public.shops
   SET plan = 'hp_web_reserve_plan',
       has_hp = true,
       has_reserve = true,
       has_agency = false
 WHERE name ILIKE '%special%grade%';

COMMIT;

-- ============================================================================
-- 確認用
--   SELECT plan, count(*) FROM public.shops GROUP BY plan ORDER BY 2 DESC;
--   -- agency_only_plan=26 / web_agency_plan=2 / hp_web_reserve_plan=1
-- ============================================================================
