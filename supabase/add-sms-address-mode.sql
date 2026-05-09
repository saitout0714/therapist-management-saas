-- shops テーブルに SMS 住所送信モードを追加
-- unified: 新規・会員問わず同じ住所を送信（デフォルト）
-- split_by_membership: 新規 = 近隣住所、会員 = 実住所
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS sms_address_mode TEXT NOT NULL DEFAULT 'unified'
    CHECK (sms_address_mode IN ('unified', 'split_by_membership'));

COMMENT ON COLUMN shops.sms_address_mode IS
  'unified: 全員同じ住所 / split_by_membership: 新規=近隣住所, 会員=実住所';

-- rooms テーブルに新規顧客向け近隣住所を追加
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS address_nearby TEXT,
  ADD COLUMN IF NOT EXISTS google_map_url_nearby TEXT;

COMMENT ON COLUMN rooms.address_nearby IS
  '新規顧客向けの近隣住所。sms_address_mode が split_by_membership の店舗で使用される。';
COMMENT ON COLUMN rooms.google_map_url_nearby IS
  '新規顧客向けの近隣 Google Maps URL。';
