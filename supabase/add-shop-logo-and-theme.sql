-- shops テーブルに logo_url と theme_color カラムを追加
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#d1b464';
