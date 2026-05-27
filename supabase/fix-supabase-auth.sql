-- ==========================================
-- Supabase Auth ログインエラー修復 SQLスクリプト
-- ==========================================
-- 理由: 手動で auth.users にインサートした際、いくつかの認証トークン列が NULL になっていました。
-- Supabase GoTrue Authサービスはこれらの列が NULL であると、スキーマクエリ時に 500 Database Error を起こしてしまいます。
-- 本スクリプトを実行することで、既存ユーザーのデータを修正し、ログイン機能を復旧します。

-- 1. 既存ユーザーの NULL トークン列を空文字に更新
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE email IN ('admin@yoyakl.tokyo', 'saitou0714@yoyakl.tokyo')
   OR id IN ('4551c7f7-6314-4dda-9681-e118478d16fa', 'd2042d7e-16cc-46fa-a55f-75bb88e051b5');

-- 2. 同期のトリガー関数を SECURITY DEFINER 属性付きで正しく定義/修正
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

-- 3. トリガーの再作成
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
