-- コース・オプション・割引・指名料にバック額カラムを追加

-- courses: コースごとのセラピストバック額
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS back_amount INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN courses.back_amount IS 'セラピストバック額（円）。固定額バック表に設定がある場合はそちらが優先。';

-- options: オプションごとのセラピストバック額
ALTER TABLE options
  ADD COLUMN IF NOT EXISTS back_amount INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN options.back_amount IS 'オプション1件あたりのセラピストバック額（円）';

-- discount_policies: 割引時のセラピスト負担額（固定円）
ALTER TABLE discount_policies
  ADD COLUMN IF NOT EXISTS therapist_burden_amount INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN discount_policies.therapist_burden_amount IS '割引発生時にセラピストが負担する固定額（円）。burden_typeがtherapist_only/splitの場合に使用。';

-- system_settings: 指名種別ごとのバック額
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS nomination_back_amount           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmed_nomination_back_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS princess_back_amount             INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN system_settings.nomination_back_amount IS '指名（通常）のセラピストバック額（円）';
COMMENT ON COLUMN system_settings.confirmed_nomination_back_amount IS '本指名のセラピストバック額（円）';
COMMENT ON COLUMN system_settings.princess_back_amount IS '姫予約のセラピストバック額（円）';
