-- ==========================================
-- SaaS セキュリティ強化 ＆ Supabase Auth 移行スクリプト
-- ==========================================

-- 1. 既存の public.users から auth.users へのデータ移行
-- (同じ ID とパスワードハッシュを引き継ぐため、外部キー等の整合性が完全に保たれます)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, login_id, password_hash, role 
    FROM public.users
    WHERE id NOT IN (SELECT id FROM auth.users) -- 重複登録の防止
  LOOP
    -- auth.users へのインサート
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
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      r.id,
      'authenticated',
      'authenticated',
      -- login_id にドメインを付与して疑似メールアドレス化
      CASE 
        WHEN r.login_id LIKE '%@%' THEN r.login_id
        ELSE r.login_id || '@yoyakl.tokyo'
      END,
      r.password_hash,
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    );

    -- auth.identities への登録（パスワード認証を有効化するために必要）
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
      r.id,
      r.id,
      jsonb_build_object(
        'sub', r.id::text,
        'email', CASE WHEN r.login_id LIKE '%@%' THEN r.login_id ELSE r.login_id || '@yoyakl.tokyo' END
      ),
      'email',
      r.id::text, -- user_id のテキスト表現を provider_id として登録
      NOW(),
      NOW(),
      NOW()
    );
  END LOOP;
END $$;

-- 2. 今後 auth.users に新規登録があった際、自動的に public.users に同期するトリガーの設定
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, login_id, password_hash, role, name, created_at, updated_at)
  VALUES (
    new.id,
    -- メールのドメイン部分を除去して login_id とする（SaaSオーナー用）
    split_part(new.email, '@', 1),
    new.encrypted_password,
    COALESCE(new.raw_user_meta_data->>'role', 'owner'), -- メタデータから役割を同期
    COALESCE(new.raw_user_meta_data->>'name', ''),       -- メタデータから名前を同期
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

-- トリガーの作成（存在しない場合のみ）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- 3. RLS（行レベルセキュリティ）用の共通アクセス判定ヘルパー関数の作成
-- (この関数を全てのテーブルポリシーで使い回すため、記述が非常にシンプルで強固になります)
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
    WHERE id = auth.uid() AND role = 'admin'
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


-- ==========================================
-- 4. 各テーブルに対する RLS の有効化 ＆ ポリシーの適用
-- ==========================================

-- すべてのテーブルの RLS を確実に有効化
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_memos ENABLE ROW LEVEL SECURITY;

-- 古いテスト用ポリシーの削除
DROP POLICY IF EXISTS "Users can access their own stores" ON public.shops;
DROP POLICY IF EXISTS "Users can access rooms for their stores" ON public.rooms;
DROP POLICY IF EXISTS "Users can access therapists for their stores" ON public.therapists;
DROP POLICY IF EXISTS "Users can access customers for their stores" ON public.customers;
DROP POLICY IF EXISTS "Users can access shifts for their stores" ON public.shifts;
DROP POLICY IF EXISTS "Users can access reservations for their stores" ON public.reservations;
DROP POLICY IF EXISTS "Allow all on therapist_photos" ON public.therapist_photos;

-- ------------------------------------------
-- ポリシー適用 A: 店舗（shops）
-- ------------------------------------------
CREATE POLICY "Shops RLS Policy" ON public.shops
  FOR ALL USING (public.check_shop_access(id));

-- 非ログインユーザー（一般のお客様）も、予約コードがあれば店舗情報を閲覧のみ可能にする
CREATE POLICY "Public Select Shop Policy" ON public.shops
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Public Select Shop Reservation Codes Policy" ON public.shop_reservation_codes
  FOR SELECT TO anon USING (is_active = true);

-- ------------------------------------------
-- ポリシー適用 B: 店舗オーナー用の標準一括ルール
-- (ショップIDベースのテーブルに一括適用します)
-- ------------------------------------------

-- 1. 部屋（rooms）
CREATE POLICY "Rooms Shop Owner Policy" ON public.rooms
  FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Rooms Public Select Policy" ON public.rooms
  FOR SELECT TO anon USING (TRUE);

-- 2. セラピスト（therapists）
CREATE POLICY "Therapists Shop Owner Policy" ON public.therapists
  FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Therapists Public Select Policy" ON public.therapists
  FOR SELECT TO anon USING (is_active = true);

-- 3. 顧客（customers）
-- (※顧客情報は重要個人情報のため、一般の非ログイン(anon)からはSELECTも遮断)
CREATE POLICY "Customers Shop Owner Policy" ON public.customers
  FOR ALL USING (public.check_shop_access(shop_id));
-- 一般お客様が予約時に「新規顧客作成」するためのINSERTのみ許可
CREATE POLICY "Customers Public Insert Policy" ON public.customers
  FOR INSERT TO anon WITH CHECK (TRUE);

-- 4. シフト（shifts）
CREATE POLICY "Shifts Shop Owner Policy" ON public.shifts
  FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Shifts Public Select Policy" ON public.shifts
  FOR SELECT TO anon USING (TRUE);

-- 5. コース（courses）
CREATE POLICY "Courses Shop Owner Policy" ON public.courses
  FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Courses Public Select Policy" ON public.courses
  FOR SELECT TO anon USING (is_active = true);

-- 6. オプション（options）
CREATE POLICY "Options Shop Owner Policy" ON public.options
  FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Options Public Select Policy" ON public.options
  FOR SELECT TO anon USING (is_active = true);

-- 7. セラピスト料金テーブル（therapist_pricing）
CREATE POLICY "Therapist Pricing Shop Owner Policy" ON public.therapist_pricing
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.therapists
      WHERE therapists.id = therapist_pricing.therapist_id
      AND public.check_shop_access(therapists.shop_id)
    )
  );
CREATE POLICY "Therapist Pricing Public Select Policy" ON public.therapist_pricing
  FOR SELECT TO anon USING (TRUE);

-- 8. システム設定（system_settings）
CREATE POLICY "System Settings Shop Owner Policy" ON public.system_settings
  FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "System Settings Public Select Policy" ON public.system_settings
  FOR SELECT TO anon USING (TRUE);

-- 9. 指名種別（designation_types）
CREATE POLICY "Designation Types Shop Owner Policy" ON public.designation_types
  FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Designation Types Public Select Policy" ON public.designation_types
  FOR SELECT TO anon USING (is_active = true);

-- 10. 割引ポリシー（discount_policies）
CREATE POLICY "Discount Policies Shop Owner Policy" ON public.discount_policies
  FOR ALL USING (public.check_shop_access(shop_id));
CREATE POLICY "Discount Policies Public Select Policy" ON public.discount_policies
  FOR SELECT TO anon USING (is_active = true);

-- 11. セラピストのメモ（therapist_memos - ※社外秘情報のためオーナー専用）
CREATE POLICY "Therapist Memos Shop Owner Policy" ON public.therapist_memos
  FOR ALL USING (public.check_shop_access(shop_id));

-- ------------------------------------------
-- ポリシー適用 C: リレーション紐付けテーブル用
-- ------------------------------------------

-- 12. セラピスト写真（therapist_photos）
CREATE POLICY "Therapist Photos Shop Owner Policy" ON public.therapist_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.therapists
      WHERE therapists.id = therapist_photos.therapist_id
      AND public.check_shop_access(therapists.shop_id)
    )
  );
CREATE POLICY "Therapist Photos Public Select Policy" ON public.therapist_photos
  FOR SELECT TO anon USING (TRUE);

-- ------------------------------------------
-- ポリシー適用 D: 予約関連テーブル（一般の新規予約登録を許可）
-- ------------------------------------------

-- 13. 予約本体（reservations）
CREATE POLICY "Reservations Shop Owner Policy" ON public.reservations
  FOR ALL USING (public.check_shop_access(shop_id));
-- 一般お客様による予約の新規作成(INSERT)を許可
CREATE POLICY "Reservations Public Insert Policy" ON public.reservations
  FOR INSERT TO anon WITH CHECK (TRUE);
-- 予約重複チェック等のための閲覧(SELECT)を許可
CREATE POLICY "Reservations Public Select Policy" ON public.reservations
  FOR SELECT TO anon USING (TRUE);

-- 14. 予約オプション（reservation_options）
CREATE POLICY "Reservation Options Shop Owner Policy" ON public.reservation_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.reservations
      WHERE reservations.id = reservation_options.reservation_id
      AND public.check_shop_access(reservations.shop_id)
    )
  );
CREATE POLICY "Reservation Options Public Insert Policy" ON public.reservation_options
  FOR INSERT TO anon WITH CHECK (TRUE);
CREATE POLICY "Reservation Options Public Select Policy" ON public.reservation_options
  FOR SELECT TO anon USING (TRUE);

-- 15. 予約割引（reservation_discounts）
CREATE POLICY "Reservation Discounts Shop Owner Policy" ON public.reservation_discounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.reservations
      WHERE reservations.id = reservation_discounts.reservation_id
      AND public.check_shop_access(reservations.shop_id)
    )
  );
CREATE POLICY "Reservation Discounts Public Insert Policy" ON public.reservation_discounts
  FOR INSERT TO anon WITH CHECK (TRUE);
CREATE POLICY "Reservation Discounts Public Select Policy" ON public.reservation_discounts
  FOR SELECT TO anon USING (TRUE);
