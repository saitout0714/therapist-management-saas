-- rooms テーブルに SMS 案内文フィールドを追加

-- 全顧客向け共通案内文（住所セクションの前に表示）
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS sms_note_common TEXT;

-- 新規顧客向け追加案内文（マップURL の後に表示）
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS sms_note_new_customer TEXT;

-- 会員向け追加案内文（マップURL の後に表示）
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS sms_note_member TEXT;

COMMENT ON COLUMN rooms.sms_note_common IS
  '全顧客向け共通案内文。■ ルームセクションの前に表示される。例: 近所の方への配慮として...';
COMMENT ON COLUMN rooms.sms_note_new_customer IS
  '新規顧客向け追加案内文。マップURLの後に表示される。例: こちらからお電話ください。';
COMMENT ON COLUMN rooms.sms_note_member IS
  '会員向け追加案内文。マップURLの後に表示される。例: ※スタート時間丁度にインターホンをお願い致します。';
