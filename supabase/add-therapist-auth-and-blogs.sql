-- === セラピスト専用ログイン・認証・ブログマイグレーション ===

-- 1. therapists テーブルにログインID・パスワードカラムを追加
ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS login_id TEXT;
ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. セラピスト写メ日記・ブログテーブルの作成
CREATE TABLE IF NOT EXISTS public.therapist_blogs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT therapist_blogs_pkey PRIMARY KEY (id)
);

-- RLS設定 (公開閲覧可・更新保護)
ALTER TABLE public.therapist_blogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read published therapist_blogs"
  ON public.therapist_blogs FOR SELECT
  USING (true);

CREATE POLICY "Allow all management for therapist_blogs"
  ON public.therapist_blogs FOR ALL
  USING (true);
