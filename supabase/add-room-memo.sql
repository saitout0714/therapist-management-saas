-- rooms テーブルにメモカラムを追加（スケジュール上でホバー表示）
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS memo TEXT;

COMMENT ON COLUMN rooms.memo IS
  'スケジュール画面でルーム名にマウスオーバーしたときに表示されるメモ。注意事項や補足情報など。';
