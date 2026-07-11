-- ==========================================
-- Add 'developer' role to users
-- ==========================================

-- 1. Drop the existing check constraint temporarily
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Add the check constraint back with the new 'developer' role
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('developer', 'system_admin', 'agency_staff', 'agency_client_owner', 'simple_client_owner'));

-- 3. Update public.check_shop_access function to allow 'developer'
CREATE OR REPLACE FUNCTION public.check_shop_access(target_shop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- A. ログインしていない場合はアクセス拒否
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- B. 開発者またはシステム管理者、受付スタッフの場合は全アクセスを許可
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('developer', 'system_admin', 'agency_staff')
  ) THEN
    RETURN TRUE;
  END IF;

  -- C. 店舗オーナーなどの場合は、自分が所有している店舗（shop_owners）のみ許可
  RETURN EXISTS (
    SELECT 1 FROM public.shop_owners
    WHERE shop_id = target_shop_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
