-- ========================================================
-- マルチショップ対応: オーナー階層と店舗階層を分離するマイグレーションSQL
-- ========================================================

-- 1. オーナーテーブル (owners) の作成
CREATE TABLE IF NOT EXISTS public.owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    plan_type VARCHAR(50) DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) の有効化とアクセスポリシーの追加
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners RLS Policy" ON public.owners;
CREATE POLICY "Owners RLS Policy" ON public.owners
    FOR ALL TO public
    USING (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND role IN ('developer', 'system_admin', 'agency_staff')
            ) OR EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND owner_id = public.owners.id
            )
        )
    );

-- 2. shops テーブルに owner_id カラム追加
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'shops' 
        AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE public.shops ADD COLUMN owner_id UUID REFERENCES public.owners(id) ON DELETE CASCADE;
        CREATE INDEX idx_shops_owner_id ON public.shops(owner_id);
    END IF;
END $$;

-- 3. users テーブルに owner_id カラム追加
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL;
        CREATE INDEX idx_users_owner_id ON public.users(owner_id);
    END IF;
END $$;

-- 4. 既存店舗・ユーザーデータのバックフィル
DO $$
DECLARE
    default_owner_id UUID;
BEGIN
    -- デフォルトオーナーが存在しなければ作成
    SELECT id INTO default_owner_id FROM public.owners WHERE code = 'default_owner' LIMIT 1;
    
    IF default_owner_id IS NULL THEN
        INSERT INTO public.owners (name, code, plan_type)
        VALUES ('デフォルトオーナー', 'default_owner', 'standard')
        RETURNING id INTO default_owner_id;
    END IF;

    -- owner_id が未設定の店舗にデフォルトオーナーを設定
    UPDATE public.shops
    SET owner_id = default_owner_id
    WHERE owner_id IS NULL;

    -- shop_owners に登録されているユーザーに対して owner_id 未設定であれば店舗の owner_id を反映
    UPDATE public.users u
    SET owner_id = s.owner_id
    FROM public.shop_owners so
    JOIN public.shops s ON so.shop_id = s.id
    WHERE u.id = so.user_id
      AND u.owner_id IS NULL;
END $$;

-- 5. RLSアクセス制御関数 check_shop_access の更新
CREATE OR REPLACE FUNCTION public.check_shop_access(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    user_owner_id UUID;
    user_role TEXT;
BEGIN
    -- A. ログインしていない場合は拒否
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- B. ユーザー情報 (role, owner_id) の取得
    SELECT role, owner_id INTO user_role, user_owner_id
    FROM public.users
    WHERE id = auth.uid();

    -- C. 開発者・システム管理者・受付スタッフは全店舗アクセス許可
    IF user_role IN ('developer', 'system_admin', 'agency_staff') THEN
        RETURN TRUE;
    END IF;

    -- D. ユーザーの owner_id と 対象店舗の owner_id が一致すればアクセス許可
    IF user_owner_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.shops
            WHERE id = target_shop_id AND owner_id = user_owner_id
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- E. shop_owners に個別登録されている場合もアクセス許可（後方互換性）
    RETURN EXISTS (
        SELECT 1 FROM public.shop_owners
        WHERE shop_id = target_shop_id AND user_id = auth.uid()
    );
END;
$function$;
