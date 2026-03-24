-- 既存の rooms テーブルに address カラムを追加
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS address TEXT;
