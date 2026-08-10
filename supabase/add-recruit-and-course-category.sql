-- ============================================================================
-- コースのカテゴリ名 (`category_name`) および 店舗求人情報 (`recruit_info`) の追加
--
-- 作成日   : 2026-08-10
-- 目的     : おニャンこスパ等のHPにおけるシステム・アクセス・求人ページのSaaS管理画面連携
-- ============================================================================

BEGIN;

-- 1. courses テーブルにカテゴリ名カラムを追加
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category_name TEXT DEFAULT '基本アロマリフレッシュコース';

-- 2. shops テーブルに求人情報 JSONB カラムを追加
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS recruit_info JSONB;

-- 3. おニャンこスパ (slug: onyankospa) の求人情報初期データを設定
UPDATE public.shops
SET recruit_info = '{
  "title": "セラピスト求人募集",
  "catchphrase": "🐾 地域最高水準のバック率 ＆ 全額日払い対応 🐾",
  "description": "ノルマ・ペナルティ一切なし！アットホームで快適な完全個室マンションルーム完備。",
  "job_type": "アロマセラピスト・トリートメント施術",
  "qualification": "18歳以上（高校生不可）、未経験者大歓迎！",
  "salary": "日給 30,000円 ～ 80,000円可能（全額日払いOK）",
  "hours": "12:00 ～ 翌5:00 (週1日・3時間～OKの自由シフト制)",
  "notes": "未経験の方でも丁寧な講習があるため安心してご応募ください。"
}'::jsonb
WHERE slug = 'onyankospa' OR name LIKE '%おニャンこ%';

-- 4. おニャンこスパの初期コースデータを追加 (既存コースが無い場合)
DO $$
DECLARE
  v_shop_id UUID;
BEGIN
  SELECT id INTO v_shop_id FROM public.shops WHERE slug = 'onyankospa' OR name LIKE '%おニャンこ%' LIMIT 1;
  IF v_shop_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.courses WHERE shop_id = v_shop_id) THEN
      INSERT INTO public.courses (shop_id, name, duration, base_price, back_amount, description, is_active, display_order, category_name) VALUES
      (v_shop_id, '70分 お試しニャンこコース', 70, 13000, 7000, '初めてのお客様やサクッと癒やされたい方に', true, 1, 'Standard Onyanko Aroma (スタンダードアロマ)'),
      (v_shop_id, '90分 定番おニャンこ贅沢コース', 90, 16000, 9000, '一番人気の定番！全身をじっくりほぐします', true, 2, 'Standard Onyanko Aroma (スタンダードアロマ)'),
      (v_shop_id, '120分 極上とろけるロングコース', 120, 21000, 12000, '存分に密着と癒やしを満を満喫したい貴方に', true, 3, 'Standard Onyanko Aroma (スタンダードアロマ)'),
      (v_shop_id, '密着ディープエステ', 0, 3000, 2000, 'お好みのおもてなしを追加できます', true, 4, 'Special Premium Option (オプション)'),
      (v_shop_id, '温感スパオイル変更', 0, 2000, 1500, 'じんわり温かいアロマオイルに変更', true, 5, 'Special Premium Option (オプション)');
    END IF;
  END IF;
END $$;

COMMIT;
