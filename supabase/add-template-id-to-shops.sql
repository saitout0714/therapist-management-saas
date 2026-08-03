-- shops テーブルに template_id カラムを追加するマイグレーション SQL
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS template_id text DEFAULT 'luxury';

-- 既存レコードの初期値を 'luxury' に更新
UPDATE shops 
SET template_id = 'luxury' 
WHERE template_id IS NULL;
