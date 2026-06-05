-- 給与引継ぎメモテーブルに精算日時・精算対象日を追加
ALTER TABLE public.therapist_memos 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolved_date DATE;
