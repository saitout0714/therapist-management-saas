-- =======================================================
-- Therapist SaaS 超クイックスタート用 統合SQLスクリプト
-- テーブルの作成からテストユーザーの登録までを一括で行います
-- =======================================================

-- 1. 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. テーブルのクリーンアップ（既存の競合を防ぐため）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
DROP TABLE IF EXISTS public.shop_owners CASCADE;
DROP TABLE IF EXISTS public.shop_reservation_codes CASCADE;
DROP TABLE IF EXISTS public.reservations CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.therapists CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.shops CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 3. shops（店舗）テーブル作成
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. users（ユーザー）テーブル作成
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'owner', 'staff')),
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. shop_owners（店舗オーナー関連付け）テーブル作成
CREATE TABLE public.shop_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, user_id)
);

-- 6. rooms（部屋）テーブル作成
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. therapists（セラピスト）テーブル作成
CREATE TABLE public.therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. customers（顧客）テーブル作成
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. shifts（シフト）テーブル作成
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  therapist_id UUID REFERENCES public.therapists(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(therapist_id, date, start_time, end_time)
);

-- 10. reservations（予約）テーブル作成
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  therapist_id UUID REFERENCES public.therapists(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
  created_by_id UUID REFERENCES public.users(id),
  reception_source VARCHAR(20) DEFAULT 'staff' CHECK (reception_source IN ('staff', 'client', 'therapist')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. デフォルト店舗の作成
INSERT INTO public.shops (name, description, is_active)
VALUES ('デフォルト店舗', 'システムのデフォルト店舗', true);

-- 12. テスト用ユーザーの作成 (IDを固定のUUIDにする)
-- パスワード: admin123
-- ハッシュ '$2a$10$P6r5FR3VEtg5.M.zw3/5EOsCo/JHjsT8/U.XSIflCJC7g81QGqc3i' は 'admin123' に対応します。
INSERT INTO public.users (id, login_id, password_hash, role, name)
VALUES (
  '00000000-0000-0000-0000-000000000001', 
  'admin', 
  '$2a$10$P6r5FR3VEtg5.M.zw3/5EOsCo/JHjsT8/U.XSIflCJC7g81QGqc3i', 
  'admin', 
  'システム管理者'
);

-- デフォルト店舗と管理者の紐付け
INSERT INTO public.shop_owners (shop_id, user_id)
SELECT id, '00000000-0000-0000-0000-000000000001'
FROM public.shops WHERE name = 'デフォルト店舗';

-- 13. Supabase Auth へのテストユーザー直接追加
-- これにより、Supabase Auth で 'admin@yoyakl.tokyo' / 'admin123' でログイン可能になります。
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@yoyakl.tokyo',
  '$2a$10$P6r5FR3VEtg5.M.zw3/5EOsCo/JHjsT8/U.XSIflCJC7g81QGqc3i',
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"admin","name":"システム管理者"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- パスワード認証を有効にするための auth.identities への登録
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"sub": "00000000-0000-0000-0000-000000000001", "email": "admin@yoyakl.tokyo"}',
  'email',
  '00000000-0000-0000-0000-000000000001',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 14. 今後 Supabase Auth 側で新規ユーザーが登録された際、自動で public.users に同期するトリガーの設定
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, login_id, password_hash, role, name, created_at, updated_at)
  VALUES (
    new.id,
    split_part(new.email, '@', 1),
    new.encrypted_password,
    COALESCE(new.raw_user_meta_data->>'role', 'owner'),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 15. RLS (Row Level Security) の有効化
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- 全テーブルへの簡易的なポリシー設定（管理者・所有オーナーが操作できるようにするポリシー）
-- (本番移行スクリプトと同等の簡略版)
CREATE OR REPLACE FUNCTION public.check_shop_access(target_shop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.shop_owners
    WHERE shop_id = target_shop_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Shops Policy" ON public.shops FOR ALL USING (public.check_shop_access(id));
CREATE POLICY "Rooms Policy" ON public.rooms FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Therapists Policy" ON public.therapists FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Customers Policy" ON public.customers FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Shifts Policy" ON public.shifts FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Reservations Policy" ON public.reservations FOR ALL USING (public.check_shop_access(shop_id));

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_shops_name ON public.shops(name);
CREATE INDEX IF NOT EXISTS idx_users_login_id ON public.users(login_id);
CREATE INDEX IF NOT EXISTS idx_rooms_shop_id ON public.rooms(shop_id);
CREATE INDEX IF NOT EXISTS idx_therapists_shop_id ON public.therapists(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_shifts_shop_id ON public.shifts(shop_id);
CREATE INDEX IF NOT EXISTS idx_reservations_shop_id ON public.reservations(shop_id);

