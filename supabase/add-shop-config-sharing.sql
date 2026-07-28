-- マルチショップ間で「料金設定(コース/オプション/割引/指名種別/店舗ルール)」と
-- 「バック設定(ランク/ランク別バック金額/延長ランク料金/控除・手当/割引ランク負担額)」を
-- 共有するための自己参照カラム。NULLの場合は自店舗のデータをそのまま使う。
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS pricing_source_shop_id uuid REFERENCES public.shops(id),
  ADD COLUMN IF NOT EXISTS back_source_shop_id uuid REFERENCES public.shops(id);

COMMENT ON COLUMN public.shops.pricing_source_shop_id IS
  '設定時、courses/options/discount_policies/designation_types/special_rulesはこの店舗のデータを参照する（マルチショップでの料金共有用）';
COMMENT ON COLUMN public.shops.back_source_shop_id IS
  '設定時、therapist_ranks/course_back_amounts/extension_rank_prices/deduction_rules/discount_rank_overrides/option_back_rules/rank_back_rules/shop_back_rulesはこの店舗のデータを参照する（マルチショップでのバック設定共有用）';
