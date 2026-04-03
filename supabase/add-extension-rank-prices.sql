-- ランク別延長料金テーブル
CREATE TABLE IF NOT EXISTS extension_rank_prices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id              UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  rank_id              UUID NOT NULL REFERENCES therapist_ranks(id) ON DELETE CASCADE,
  extension_unit_price INTEGER NOT NULL DEFAULT 0,
  extension_unit_back  INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, rank_id)
);
