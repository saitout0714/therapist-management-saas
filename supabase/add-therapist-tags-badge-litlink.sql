-- ============================================================================
-- セラピストのHP掲載用項目（タグ・バッジ・リットリンク）を追加
--
-- 作成日 : 2026-08-06
-- 適用先 : PRODUCTION DATABASE
-- 内容   : therapists テーブルに tags / badge / litlink_url 列を追加（非破壊）
-- ============================================================================

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS badge text;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS litlink_url text;
