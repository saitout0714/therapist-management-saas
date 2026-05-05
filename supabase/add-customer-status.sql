-- customers テーブルに status / ng_reason カラムを追加

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS status    TEXT NOT NULL DEFAULT '予約可',
  ADD COLUMN IF NOT EXISTS ng_reason TEXT;

COMMENT ON COLUMN customers.status    IS '予約可 / 要注意 / 出禁';
COMMENT ON COLUMN customers.ng_reason IS 'status が 出禁/要注意 の場合の理由メモ';
