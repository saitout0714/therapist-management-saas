-- ==========================================
-- Update roles to new definitions
-- ==========================================

-- 0. Drop the existing check constraint temporarily
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 1. Update public.users
UPDATE public.users SET role = 'system_admin' WHERE role = 'admin';
UPDATE public.users SET role = 'simple_client_owner' WHERE role = 'owner';
UPDATE public.users SET role = 'agency_staff' WHERE role = 'staff';

-- 1.5 Add the check constraint back with the new roles
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('system_admin', 'agency_staff', 'agency_client_owner', 'simple_client_owner'));

-- 2. Update auth.users metadata
UPDATE auth.users
SET raw_user_meta_data = 
  CASE 
    WHEN raw_user_meta_data->>'role' = 'admin' THEN jsonb_set(raw_user_meta_data, '{role}', '"system_admin"')
    WHEN raw_user_meta_data->>'role' = 'owner' THEN jsonb_set(raw_user_meta_data, '{role}', '"simple_client_owner"')
    WHEN raw_user_meta_data->>'role' = 'staff' THEN jsonb_set(raw_user_meta_data, '{role}', '"agency_staff"')
    ELSE raw_user_meta_data
  END
WHERE raw_user_meta_data->>'role' IN ('admin', 'owner', 'staff');

-- 3. Update public.check_shop_access function to use system_admin instead of admin
CREATE OR REPLACE FUNCTION public.check_shop_access(target_shop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- A. ログインしていない場合はアクセス拒否
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- B. システム管理者の場合は全アクセスを許可
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'system_admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- C. 店舗オーナーの場合は、自分が所有している店舗（shop_owners）のみ許可
  RETURN EXISTS (
    SELECT 1 FROM public.shop_owners
    WHERE shop_id = target_shop_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update public.handle_new_auth_user trigger function to fallback to 'simple_client_owner' instead of obsolete 'owner'
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, login_id, password_hash, role, name, created_at, updated_at)
  VALUES (
    new.id,
    -- メールのドメイン部分を除去して login_id とする（SaaSオーナー用）
    split_part(new.email, '@', 1),
    new.encrypted_password,
    COALESCE(new.raw_user_meta_data->>'role', 'simple_client_owner'), -- 'owner' から 'simple_client_owner' へ変更
    COALESCE(new.raw_user_meta_data->>'name', ''),
    new.created_at,
    new.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    login_id = EXCLUDED.login_id,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    name = EXCLUDED.name,
    updated_at = NOW();
  RETURN NEW;
END;
$function$;

