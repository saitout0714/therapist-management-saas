-- Add therapist_line_mode column to shops table
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS therapist_line_mode text NOT NULL DEFAULT 'official_line';

COMMENT ON COLUMN public.shops.therapist_line_mode IS 'セラピスト連絡用LINEモード (official_line: 公式LINE, line: 普通のLINE)';
