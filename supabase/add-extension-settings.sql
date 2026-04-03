-- 延長設定をsystem_settingsに追加
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS extension_unit_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS extension_unit_price   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extension_unit_back    INTEGER NOT NULL DEFAULT 0;

-- 予約テーブルに延長回数カラムを追加
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS extension_count INTEGER NOT NULL DEFAULT 0;
