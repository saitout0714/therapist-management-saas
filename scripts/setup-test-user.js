/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!projectUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL が未設定です。.env.local を確認してください。');
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local に設定してください。');
}

const supabase = createClient(projectUrl, serviceRoleKey);

async function createOrUpdateTestUser() {
  try {
    console.log('🚀 Creating test user...');

    const loginId = 'admin';
    const email = `${loginId}@yoyakl.tokyo`;
    const password = 'admin123';
    const role = 'admin';

    // パスワードをハッシュ化 (public.usersテーブルの制約用)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Supabase Auth 管理用APIを使用してユーザーの作成・更新

    console.log('🔑 Setting up user in Supabase Auth...');
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing auth users:', listError);
      throw listError;
    }

    const existingAuthUser = usersData.users.find(u => u.email === email);
    let userId;

    if (existingAuthUser) {
      console.log('📝 Auth user already exists. Updating password and metadata...');
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        existingAuthUser.id,
        { 
          password: password, 
          user_metadata: { role: role } 
        }
      );

      if (updateError) {
        console.error('❌ Error updating auth user:', updateError);
        throw updateError;
      }
      userId = existingAuthUser.id;
      console.log('✅ Auth user updated successfully');
    } else {
      console.log('➕ Creating new user in Supabase Auth...');
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: role }
      });

      if (createError) {
        console.error('❌ Error creating auth user:', createError);
        throw createError;
      }
      userId = newUser.user.id;
      console.log('✅ Auth user created successfully');
    }

    // public.usersテーブルとの同期（トリガーが何らかの理由で発火しなかった場合や、既存ユーザー更新時のフォールバック）
    console.log('🔄 Syncing user into public.users table...');
    
    // 競合する古いテストユーザー (異なるIDで登録されているもの) を削除
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('login_id', loginId)
      .neq('id', userId);
      
    if (deleteError) {
      console.warn('⚠️ Warning during old user cleanup:', deleteError.message);
    }

    const { error: syncError } = await supabase
      .from('users')
      .upsert({

        id: userId,
        login_id: loginId,
        password_hash: hashedPassword,
        role: role,
        name: '管理者',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });


    if (syncError) {
      console.error('❌ Error syncing public.users:', syncError);
      throw syncError;
    }
    console.log('✅ Synchronized public.users successfully');




    // デフォルト店舗を取得または作成
    console.log('🏪 Checking default shop...');
    
    const { data: shops, error: shopError } = await supabase
      .from('shops')
      .select('id')
      .eq('name', 'デフォルト店舗')
      .limit(1);

    if (shopError) {
      console.error('❌ Error checking shops:', shopError);
      throw shopError;
    }

    let shopId;
    if (shops && shops.length > 0) {
      shopId = shops[0].id;
      console.log('✅ Default shop found');
    } else {
      // デフォルト店舗を作成
      const { data: newShop, error: createShopError } = await supabase
        .from('shops')
        .insert([{ name: 'デフォルト店舗', description: 'システムのデフォルト店舗', is_active: true }])
        .select()
        .single();

      if (createShopError) {
        console.error('❌ Error creating shop:', createShopError);
        throw createShopError;
      }
      
      shopId = newShop.id;
      console.log('✅ Default shop created');
    }

    // shop_ownersの関連付けを確認・作成
    console.log('🔗 Checking shop owner relationship...');
    
    const { data: existingOwner, error: ownerCheckError } = await supabase
      .from('shop_owners')
      .select('id')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .limit(1);

    if (ownerCheckError) {
      console.error('❌ Error checking shop owner:', ownerCheckError);
      throw ownerCheckError;
    }

    if (!existingOwner || existingOwner.length === 0) {
      const { error: ownerInsertError } = await supabase
        .from('shop_owners')
        .insert([{ shop_id: shopId, user_id: userId }]);

      if (ownerInsertError) {
        console.error('❌ Error creating shop owner relationship:', ownerInsertError);
        throw ownerInsertError;
      }
      console.log('✅ Shop owner relationship created');
    } else {
      console.log('✅ Shop owner relationship already exists');
    }

    console.log('\n✨ Test user setup completed!');
    console.log('📧 Login ID: admin');
    console.log('🔑 Password: admin123');

    
  } catch (error) {
    console.error('❌ Setup error:', error);
    process.exit(1);
  }
}

createOrUpdateTestUser();
