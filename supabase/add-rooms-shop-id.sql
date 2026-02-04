-- ルームテーブルに shop_id を追加
ALTER TABLE rooms ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
CREATE INDEX idx_rooms_shop_id ON rooms(shop_id);

-- 既存データをデフォルト店舗に紐付け
UPDATE rooms
SET shop_id = (
  SELECT id FROM shops ORDER BY created_at ASC LIMIT 1
)
WHERE shop_id IS NULL;
