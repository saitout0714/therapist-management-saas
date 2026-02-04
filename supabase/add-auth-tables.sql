-- ユーザー認証テーブル
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'owner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- 店舗オーナー関連付け
CREATE TABLE IF NOT EXISTS shop_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, user_id)
);

CREATE INDEX idx_shop_owners_shop_id ON shop_owners(shop_id);
CREATE INDEX idx_shop_owners_user_id ON shop_owners(user_id);

-- 予約コード（顧客向けURL用）
CREATE TABLE IF NOT EXISTS shop_reservation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shop_reservation_codes_shop_id ON shop_reservation_codes(shop_id);
CREATE INDEX idx_shop_reservation_codes_code ON shop_reservation_codes(code);
