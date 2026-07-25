-- ========================================================
-- グループ内での顧客・セラピストデータ一元化・共有マイグレーション
-- ========================================================

-- 1. owners テーブルに共有フラグを追加
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'owners' 
        AND column_name = 'share_customers'
    ) THEN
        ALTER TABLE public.owners ADD COLUMN share_customers BOOLEAN DEFAULT true;
        ALTER TABLE public.owners ADD COLUMN share_therapists BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 2. customers テーブルに owner_id カラムを追加
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'customers' 
        AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE public.customers ADD COLUMN owner_id UUID REFERENCES public.owners(id) ON DELETE CASCADE;
        CREATE INDEX idx_customers_owner_id ON public.customers(owner_id);
    END IF;
END $$;

-- 3. therapists テーブルに owner_id カラムを追加
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'therapists' 
        AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE public.therapists ADD COLUMN owner_id UUID REFERENCES public.owners(id) ON DELETE CASCADE;
        CREATE INDEX idx_therapists_owner_id ON public.therapists(owner_id);
    END IF;
END $$;

-- 4. therapist_shops テーブル (セラピストの複数店舗出勤用中間テーブル) の作成
CREATE TABLE IF NOT EXISTS public.therapist_shops (
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (therapist_id, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_therapist_shops_shop_id ON public.therapist_shops(shop_id);

-- 5. 既存データのバックフィル (customers.owner_id, therapists.owner_id, therapist_shops の初期化)
DO $$
BEGIN
    -- customers の owner_id を所属店舗の owner_id から反映
    UPDATE public.customers c
    SET owner_id = s.owner_id
    FROM public.shops s
    WHERE c.shop_id = s.id
      AND c.owner_id IS NULL;

    -- therapists の owner_id を所属店舗の owner_id から反映
    UPDATE public.therapists t
    SET owner_id = s.owner_id
    FROM public.shops s
    WHERE t.shop_id = s.id
      AND t.owner_id IS NULL;

    -- therapist_shops に既存セラピストと店舗のペアを投入
    INSERT INTO public.therapist_shops (therapist_id, shop_id)
    SELECT id, shop_id
    FROM public.therapists
    WHERE shop_id IS NOT NULL
    ON CONFLICT (therapist_id, shop_id) DO NOTHING;
END $$;

-- 6. RLS Policies の設定
ALTER TABLE public.therapist_shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapist Shops Policy" ON public.therapist_shops;
CREATE POLICY "Therapist Shops Policy" ON public.therapist_shops
    FOR ALL TO public
    USING (
        check_shop_access(shop_id) OR EXISTS (
            SELECT 1 FROM public.therapists t
            JOIN public.shops s ON s.id = target_shop_id
            WHERE t.id = therapist_id AND t.owner_id = s.owner_id
        )
    );
