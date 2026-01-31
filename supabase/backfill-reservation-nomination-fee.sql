-- 既存予約の指名料/本指名料/姫予約料金を再計算して反映
WITH latest_settings AS (
  SELECT
    default_nomination_fee,
    default_confirmed_nomination_fee,
    default_princess_reservation_fee
  FROM system_settings
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE reservations r
SET
  nomination_fee = CASE
    WHEN r.designation_type = 'nomination' THEN
      COALESCE(
        NULLIF(
          (SELECT tp.nomination_fee FROM therapist_pricing tp WHERE tp.therapist_id = r.therapist_id),
          0
        ),
        ls.default_nomination_fee,
        0
      )
    WHEN r.designation_type = 'confirmed' THEN
      COALESCE(
        NULLIF(
          (SELECT tp.confirmed_nomination_fee FROM therapist_pricing tp WHERE tp.therapist_id = r.therapist_id),
          0
        ),
        ls.default_confirmed_nomination_fee,
        0
      )
    WHEN r.designation_type = 'princess' THEN
      COALESCE(
        NULLIF(
          (SELECT tp.princess_reservation_fee FROM therapist_pricing tp WHERE tp.therapist_id = r.therapist_id),
          0
        ),
        ls.default_princess_reservation_fee,
        0
      )
    ELSE 0
  END,
  total_price = GREATEST(
    0,
    COALESCE(r.base_price, 0)
    + COALESCE(r.options_price, 0)
    + CASE
        WHEN r.designation_type = 'nomination' THEN
          COALESCE(
            NULLIF(
              (SELECT tp.nomination_fee FROM therapist_pricing tp WHERE tp.therapist_id = r.therapist_id),
              0
            ),
            ls.default_nomination_fee,
            0
          )
        WHEN r.designation_type = 'confirmed' THEN
          COALESCE(
            NULLIF(
              (SELECT tp.confirmed_nomination_fee FROM therapist_pricing tp WHERE tp.therapist_id = r.therapist_id),
              0
            ),
            ls.default_confirmed_nomination_fee,
            0
          )
        WHEN r.designation_type = 'princess' THEN
          COALESCE(
            NULLIF(
              (SELECT tp.princess_reservation_fee FROM therapist_pricing tp WHERE tp.therapist_id = r.therapist_id),
              0
            ),
            ls.default_princess_reservation_fee,
            0
          )
        ELSE 0
      END
    - COALESCE(r.discount_amount, 0)
  )
FROM latest_settings ls
WHERE (r.nomination_fee IS NULL OR r.nomination_fee = 0)
  AND r.designation_type IN ('nomination', 'confirmed', 'princess');
