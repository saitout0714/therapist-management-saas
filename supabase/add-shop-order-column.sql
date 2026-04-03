-- 店舗テーブルに order カラムを追加
ALTER TABLE shops ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- 既存の店舗に連番の順序を設定
WITH ordered_shops AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 as new_order
  FROM shops
)
UPDATE shops
SET "order" = ordered_shops.new_order
FROM ordered_shops
WHERE shops.id = ordered_shops.id;
