-- 店舗テーブル作成
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- セラピストテーブルに shop_id を追加
ALTER TABLE therapists ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
CREATE INDEX idx_therapists_shop_id ON therapists(shop_id);

-- 顧客テーブルに shop_id を追加
ALTER TABLE customers ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
CREATE INDEX idx_customers_shop_id ON customers(shop_id);

-- 予約テーブルに shop_id を追加
ALTER TABLE reservations ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
CREATE INDEX idx_reservations_shop_id ON reservations(shop_id);

-- シフトテーブルに shop_id を追加
ALTER TABLE shifts ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
CREATE INDEX idx_shifts_shop_id ON shifts(shop_id);

-- コースデータを全店舗で共有する場合はスキップ
-- 共有したくない場合は以下を実行:
-- ALTER TABLE courses ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;
-- CREATE INDEX idx_courses_shop_id ON courses(shop_id);

-- デフォルト店舗を作成
INSERT INTO shops (name, description) VALUES ('デフォルト店舗', 'システムのデフォルト店舗');
