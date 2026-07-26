-- キャスカン予約同期用: reservations に外部予約IDを保存する列を追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS caskan_reservation_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS reservations_caskan_reservation_id_key
  ON reservations (caskan_reservation_id)
  WHERE caskan_reservation_id IS NOT NULL;
