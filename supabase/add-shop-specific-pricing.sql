-- 1. 既存のsystem_settingsテーブルをバックアップとしてrenameして、新しいテーブルを作成
ALTER TABLE IF EXISTS system_settings RENAME TO system_settings_backup;

-- 2. 新しいsystem_settingsテーブルを作成（shop_idを含む）
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  default_nomination_fee INTEGER NOT NULL DEFAULT 0,
  default_confirmed_nomination_fee INTEGER NOT NULL DEFAULT 0,
  default_princess_reservation_fee INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id)
);

-- 3. インデックスを作成
CREATE INDEX idx_system_settings_shop_id ON system_settings(shop_id);

-- 4. 既存データを新しいテーブルに移行（すべてのアクティブな店舗に対して最初のシステム設定を複製）
INSERT INTO system_settings (shop_id, default_nomination_fee, default_confirmed_nomination_fee, default_princess_reservation_fee)
SELECT shops.id, 0, 0, 0
FROM shops
WHERE shops.is_active = true
ON CONFLICT (shop_id) DO NOTHING;

-- 5. 必要に応じて古いテーブルを削除（データ確認後）
-- DROP TABLE IF EXISTS system_settings_backup;
