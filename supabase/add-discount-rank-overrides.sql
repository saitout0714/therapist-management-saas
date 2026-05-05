-- ランク別割引セラピスト負担額オーバーライド
-- discount_policies の therapist_burden_amount をランクごとに上書きできる

CREATE TABLE IF NOT EXISTS discount_rank_overrides (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                 UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  discount_policy_id      UUID NOT NULL REFERENCES discount_policies(id) ON DELETE CASCADE,
  rank_id                 UUID NOT NULL REFERENCES therapist_ranks(id) ON DELETE CASCADE,
  therapist_burden_amount INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE (discount_policy_id, rank_id)
);

COMMENT ON TABLE discount_rank_overrides
  IS 'ランク別の割引セラピスト負担額設定。discount_policies.therapist_burden_amount のランク別上書き。';

ALTER TABLE discount_rank_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access discount_rank_overrides" ON discount_rank_overrides FOR ALL USING (true);
