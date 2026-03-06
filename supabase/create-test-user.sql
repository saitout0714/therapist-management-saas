-- テストユーザーを作成または更新
-- メールアドレス: admin@example.com  
-- パスワード: admin123

-- 既存のテストユーザーを削除（存在する場合）
DELETE FROM shop_owners WHERE user_id IN (SELECT id FROM users WHERE email = 'admin@example.com');
DELETE FROM users WHERE email = 'admin@example.com';

-- テストユーザーを作成
INSERT INTO users (email, password_hash, role) 
VALUES ('admin@example.com', '$2b$10$P6r5FR3VEtg5.M.zw3/5EOsCo/JHjsT8/U.XSIflCJC7g81QGqc3i', 'admin');

-- デフォルト店舗が存在することを確認
DO $$
DECLARE
    default_shop_id UUID;
    admin_user_id UUID;
BEGIN
    -- デフォルト店舗を取得または作成
    SELECT id INTO default_shop_id FROM shops WHERE name = 'デフォルト店舗' LIMIT 1;
    
    IF default_shop_id IS NULL THEN
        INSERT INTO shops (name, description, is_active) 
        VALUES ('デフォルト店舗', 'システムのデフォルト店舗', true)
        RETURNING id INTO default_shop_id;
    END IF;
    
    -- 作成したadminユーザーのIDを取得
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@example.com';
    
    -- adminユーザーをデフォルト店舗のオーナーとして登録
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO shop_owners (shop_id, user_id)
        VALUES (default_shop_id, admin_user_id)
        ON CONFLICT (shop_id, user_id) DO NOTHING;
    END IF;
END $$;
