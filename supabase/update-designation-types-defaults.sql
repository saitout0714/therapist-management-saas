-- ============================================================
-- 指名種別マスタにデフォルト料金とデフォルトバック額を追加
-- ============================================================

ALTER TABLE designation_types
  ADD COLUMN IF NOT EXISTS default_fee INTEGER DEFAULT 0;

ALTER TABLE designation_types
  ADD COLUMN IF NOT EXISTS default_back_amount INTEGER DEFAULT 0;

-- 既存の指名種別に対して、SPA RICH等の要件に合わせてデフォルト値を埋める（任意）
-- 既に詳細設定マトリクス表（course_back_amounts）がある場合はそちらが優先されます。
