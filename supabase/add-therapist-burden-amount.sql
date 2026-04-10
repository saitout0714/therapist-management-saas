-- reservation_discounts にセラピスト負担額（円）を追加
-- burden_type の enum 代わりに具体的な金額で管理できるようにする

ALTER TABLE reservation_discounts
  ADD COLUMN IF NOT EXISTS therapist_burden_amount INTEGER;

COMMENT ON COLUMN reservation_discounts.therapist_burden_amount
  IS 'セラピストが負担する割引額（円）。NULL の場合は burden_type で旧来の比率計算にフォールバック。';
