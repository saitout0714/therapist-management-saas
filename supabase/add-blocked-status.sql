-- reserved status に 'blocked' を追加する
-- 既存の check 制約を削除して再作成

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'blocked'));
