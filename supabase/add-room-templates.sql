-- rooms テーブルにテンプレートフィールドを追加
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS template_member TEXT,
  ADD COLUMN IF NOT EXISTS template_new_customer TEXT;

COMMENT ON COLUMN rooms.display_name IS
  'マンション名。お客様向けテキスト等に使用する名称。';
COMMENT ON COLUMN rooms.template_member IS
  '会員様向けSMSテンプレート。住所・マップURLを含む案内文全体を記載。';
COMMENT ON COLUMN rooms.template_new_customer IS
  '新規様向けSMSテンプレート。住所・マップURLを含む案内文全体を記載。';
