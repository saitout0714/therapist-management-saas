-- shop_back_rules テーブルにデフォルト固定額バックカラムを追加
-- パーセンテージ方式を廃止し、金額方式に統一する

ALTER TABLE shop_back_rules
  ADD COLUMN IF NOT EXISTS course_back_amount       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS option_back_amount       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nomination_back_amount   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_therapist_burden INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN shop_back_rules.course_back_amount
  IS '店舗デフォルト：コース1件あたりのセラピストバック額（円）';
COMMENT ON COLUMN shop_back_rules.option_back_amount
  IS '店舗デフォルト：オプション1件あたりのセラピストバック額（円）';
COMMENT ON COLUMN shop_back_rules.nomination_back_amount
  IS '店舗デフォルト：指名料のセラピストバック額（円）';
COMMENT ON COLUMN shop_back_rules.discount_therapist_burden
  IS '店舗デフォルト：割引発生時のセラピスト負担額（円）';
