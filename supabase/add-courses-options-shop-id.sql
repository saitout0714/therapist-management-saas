-- コーステーブルに shop_id を追加
ALTER TABLE courses ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
CREATE INDEX idx_courses_shop_id ON courses(shop_id);

-- オプションテーブルに shop_id を追加
ALTER TABLE options ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
CREATE INDEX idx_options_shop_id ON options(shop_id);

-- 既存データをデフォルト店舗に紐付け
UPDATE courses
SET shop_id = (
  SELECT id FROM shops ORDER BY created_at ASC LIMIT 1
)
WHERE shop_id IS NULL;

UPDATE options
SET shop_id = (
  SELECT id FROM shops ORDER BY created_at ASC LIMIT 1
)
WHERE shop_id IS NULL;
