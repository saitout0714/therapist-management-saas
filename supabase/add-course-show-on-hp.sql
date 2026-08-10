-- ============================================================================
-- コースをHPに掲載するかどうかのフラグを追加
--
-- 作成日 : 2026-08-06
-- 適用先 : PRODUCTION DATABASE
-- 内容   : courses テーブルに show_on_hp 列を追加（非破壊・既存行はデフォルトtrueで従来通りHPに表示）
-- ============================================================================

ALTER TABLE courses ADD COLUMN IF NOT EXISTS show_on_hp boolean NOT NULL DEFAULT true;
