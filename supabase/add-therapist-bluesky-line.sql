-- therapists / therapist_shops テーブルに bluesky_url, line_url を追加
ALTER TABLE IF EXISTS public.therapists
  ADD COLUMN IF NOT EXISTS bluesky_url text,
  ADD COLUMN IF NOT EXISTS line_url text;

ALTER TABLE IF EXISTS public.therapist_shops
  ADD COLUMN IF NOT EXISTS bluesky_url text,
  ADD COLUMN IF NOT EXISTS line_url text;
