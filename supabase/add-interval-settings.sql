-- 予約インターバル設定の追加
-- system_settings: 店舗デフォルトのインターバル（分）
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS reservation_interval_minutes INTEGER NOT NULL DEFAULT 20;

-- therapists: セラピスト個別インターバル（NULL = 店舗デフォルトを使用）
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS reservation_interval_minutes INTEGER DEFAULT NULL;

COMMENT ON COLUMN system_settings.reservation_interval_minutes IS '予約と予約の間のインターバル（分）。店舗デフォルト値。';
COMMENT ON COLUMN therapists.reservation_interval_minutes IS '予約と予約の間のインターバル（分）。NULLの場合は店舗デフォルトを使用。';
