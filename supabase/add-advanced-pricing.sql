-- 1. `therapist_ranks` (セラピストランクマスタ)
CREATE TABLE IF NOT EXISTS therapist_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. セラピストへのカラム追加 (既存テーブル拡張)
ALTER TABLE therapists 
ADD COLUMN IF NOT EXISTS rank_id uuid REFERENCES therapist_ranks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS has_fee_override boolean DEFAULT false;

-- 3. `courses` への「指名料込みフラグ」追加
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS includes_nomination_fee boolean DEFAULT false;

-- 4. `nomination_fees` (指名料マスタ)
CREATE TABLE IF NOT EXISTS nomination_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  fee_type text NOT NULL, -- 'first_time', 'regular', 'princess', 'photo' 等
  name text NOT NULL,
  price integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. `therapist_fee_overrides` (個別の例外料金設定)
CREATE TABLE IF NOT EXISTS therapist_fee_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  fee_type_id uuid NOT NULL REFERENCES nomination_fees(id) ON DELETE CASCADE,
  override_price integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(therapist_id, fee_type_id)
);

-- 6. `options` カラム追加（構造変更）
ALTER TABLE options
ADD COLUMN IF NOT EXISTS option_type text NOT NULL DEFAULT 'extension', -- 'extension' or 'item'
ADD COLUMN IF NOT EXISTS duration_minutes_added integer DEFAULT 0;

-- 7. RLSの設定
ALTER TABLE therapist_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomination_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_fee_overrides ENABLE ROW LEVEL SECURITY;

-- 既存テーブル（therapists, courses, options）には既にRLSが設定されている前提ですが、もし無ければ設定してください。

-- 誰でも(anon/authenticated)読み取れるようにするポリシー（要件次第ですが、基本はauthenticatedで全店読み取り可能にするか、自店舗のみにするか）
-- ここではシンプルに authenticated ユーザーに対してフルアクセスを許可する例を示します。
-- （※実際のプロジェクトのポリシー運用に合わせて調整してください）

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'therapist_ranks' AND policyname = 'Enable all access for authenticated users on therapist_ranks'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users on therapist_ranks" ON therapist_ranks FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'nomination_fees' AND policyname = 'Enable all access for authenticated users on nomination_fees'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users on nomination_fees" ON nomination_fees FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'therapist_fee_overrides' AND policyname = 'Enable all access for authenticated users on therapist_fee_overrides'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users on therapist_fee_overrides" ON therapist_fee_overrides FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END
$$;
