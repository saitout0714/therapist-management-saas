-- ========================================================
-- セラピストの店舗別源氏名（alias_name）追加マイグレーション
-- ========================================================

-- 1. therapist_shops テーブルがなければ作成
CREATE TABLE IF NOT EXISTS public.therapist_shops (
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    alias_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (therapist_id, shop_id)
);

-- 2. カラムがなければ追加
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'therapist_shops' 
        AND column_name = 'alias_name'
    ) THEN
        ALTER TABLE public.therapist_shops ADD COLUMN alias_name VARCHAR(255);
    END IF;
END $$;
