-- reservations テーブルに is_handled カラム（対応状況フラグ）を追加します。
-- 初期値は true に設定し、既存の予約や店側で作成した予約はデフォルトで対応済みとして扱います。
-- Web予約 API から登録されたもののみ false (未対応) に設定します。

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_handled BOOLEAN DEFAULT true;

-- もし NULL の値が存在する場合、すべて対応済み(true)にアップデートします。
UPDATE reservations SET is_handled = true WHERE is_handled IS NULL;

-- 確認用クエリ
-- SELECT id, date, start_time, source, is_handled FROM reservations ORDER BY created_at DESC LIMIT 10;
