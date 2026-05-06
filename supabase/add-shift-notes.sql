-- shiftsテーブルにメモカラムを追加
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS notes TEXT;
