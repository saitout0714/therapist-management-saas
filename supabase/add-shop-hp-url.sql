-- shopsテーブルに店舗HP URLカラムを追加
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS hp_url text;
