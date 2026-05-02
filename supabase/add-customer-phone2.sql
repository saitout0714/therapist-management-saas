-- 顧客テーブルに第2電話番号カラムを追加
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone2 TEXT;
