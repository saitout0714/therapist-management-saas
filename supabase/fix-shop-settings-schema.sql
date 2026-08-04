-- ============================================================================
-- 店舗設定まわりの「保存できない」を解消するための不足スキーマ追加
--
-- 作成日   : 2026-08-04
-- 適用先   : PRODUCTION（NEXT_PUBLIC_SUPABASE_URL と同一プロジェクト）
-- 性質     : 追加のみ。既存カラム・既存データの削除／変更は一切行わない。
-- 想定所要 : 数秒
--
-- 背景:
--   /system の「店舗基本情報」と /admin/store-setting の「店舗基本情報」は、
--   実DBに存在しないカラムへ書き込もうとしており、保存が毎回失敗していた。
--   PostgREST は未知のカラムが1つでもあると UPDATE 全体を拒否するため、
--   店舗名や電話番号など実在するカラムまで巻き添えで保存されていない。
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. shops : 店舗基本情報／HP表示に使うカラム
--    （supabase/phase2-schema-and-rls.sql が未適用だったぶん ＋ 不足分）
-- ----------------------------------------------------------------------------
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS catchphrase    TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS access_info    TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS business_hours TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS address        TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS google_map_url TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS line_url       TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS x_url          TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS litlink_url    TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS notice_banner  TEXT;

-- 公開HPのURLに使う英数字の識別子。
-- 既存の short_name は日本語・カタカナのため自動流用しない（空のまま追加）。
-- 値の設定は店舗ごとに別途行う。未設定でも店舗名／IDで解決されるため影響なし。
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS slug           TEXT;

-- ----------------------------------------------------------------------------
-- 2. shops / users : 契約プラン・機能フラグ
--    NOT NULL や DEFAULT false は付けない。
--    既存29店舗が一斉に false になると、アプリ側の
--    「値が無ければプラン名から推測する」フォールバックが効かなくなり、
--    HPメニュー等が全店舗で消えてしまうため、あえて NULL 許容にする。
-- ----------------------------------------------------------------------------
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS plan        TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS has_hp      BOOLEAN;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS has_reserve BOOLEAN;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS has_agency  BOOLEAN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan        TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_hp      BOOLEAN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_reserve BOOLEAN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_agency  BOOLEAN;

-- ----------------------------------------------------------------------------
-- 3. campaigns : HPのメインバナー／スライドショー
--    テーブル自体が存在せず、登録しても保存されない状態だった。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  image_url     text NOT NULL,
  link_url      text,
  badge_text    text,
  display_order integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_shop_id_idx
  ON public.campaigns (shop_id, display_order);

-- ----------------------------------------------------------------------------
-- 4. news_items : HPの新着トピックス／お知らせ
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title        text NOT NULL,
  content      text NOT NULL DEFAULT '',
  category     text NOT NULL DEFAULT 'お知らせ',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_items_shop_id_idx
  ON public.news_items (shop_id, published_at DESC);

-- ----------------------------------------------------------------------------
-- 5. RLS : 既存の therapist_blogs / shop_reservation_codes と同じ方針に揃える
--    （管理画面は独自認証で anon キーを使うため、管理操作は public ロールに許可し、
--      公開HP向けに anon の SELECT を別途用意する）
-- ----------------------------------------------------------------------------
ALTER TABLE public.campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all management for campaigns" ON public.campaigns;
CREATE POLICY "Allow all management for campaigns"
  ON public.campaigns FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read active campaigns" ON public.campaigns;
CREATE POLICY "Allow public read active campaigns"
  ON public.campaigns FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "Allow all management for news_items" ON public.news_items;
CREATE POLICY "Allow all management for news_items"
  ON public.news_items FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read news_items" ON public.news_items;
CREATE POLICY "Allow public read news_items"
  ON public.news_items FOR SELECT TO anon USING (true);

COMMIT;

-- ============================================================================
-- 適用後の確認用（任意）
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='shops' ORDER BY ordinal_position;
--   -- 28 → 42 カラムになっていれば成功
--
--   SELECT count(*) FROM public.campaigns;   -- 0 が返れば成功
--   SELECT count(*) FROM public.news_items;  -- 0 が返れば成功
-- ============================================================================
