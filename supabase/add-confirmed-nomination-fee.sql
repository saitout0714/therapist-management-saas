-- セラピスト料金に本指名料を追加
ALTER TABLE therapist_pricing ADD COLUMN IF NOT EXISTS confirmed_nomination_fee INTEGER DEFAULT 0;
