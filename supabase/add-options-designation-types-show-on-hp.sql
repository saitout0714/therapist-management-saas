-- ============================================================================
-- オプション・指名種別をHPに掲載するかどうかのフラグを追加
--
-- 作成日 : 2026-08-06
-- 適用先 : PRODUCTION DATABASE
-- 内容   : options / designation_types に show_on_hp 列を追加（非破壊、courses.show_on_hpと同じパターン）
-- ============================================================================

ALTER TABLE options ADD COLUMN IF NOT EXISTS show_on_hp boolean DEFAULT true;
ALTER TABLE designation_types ADD COLUMN IF NOT EXISTS show_on_hp boolean DEFAULT true;
