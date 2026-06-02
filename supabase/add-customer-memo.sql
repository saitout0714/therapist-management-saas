-- customers テーブルに memo カラムを追加

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS memo TEXT;

COMMENT ON COLUMN customers.memo IS '顧客に関する特記事項や申し送りメモ';
