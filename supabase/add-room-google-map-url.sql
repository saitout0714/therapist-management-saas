-- rooms テーブルに Google Maps URL を追加
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS google_map_url TEXT;

COMMENT ON COLUMN rooms.google_map_url
  IS 'Google マップの共有URL。お客様用LINEテキストに記載される。';
