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

    const email = 'admin@example.com';
    const password = 'admin123';
    const role = 'admin';

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // 既存のユーザーをチェック
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email);

    if (checkError) {
      console.error('❌ Error checking existing user:', checkError);
      throw checkError;
    }

    let userId;

    if (existingUsers && existingUsers.length > 0) {
      // ユーザーが存在する場合は更新
      userId = existingUsers[0].id;
      console.log('📝 Updating existing user...');
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword, role: role, updated_at: new Date().toISOString() })
        .eq('email', email);

      if (updateError) {
        console.error('❌ Error updating user:', updateError);
        throw updateError;
      }
      console.log('✅ User updated successfully');
    } else {
      // ユーザーが存在しない場合は作成
      console.log('➕ Creating new user...');
      
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ email, password_hash: hashedPassword, role }])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating user:', insertError);
        throw insertError;
      }
      
      userId = newUser.id;
      console.log('✅ User created successfully');
    }

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
    console.log('📧 Email: admin@example.com');
    console.log('🔑 Password: admin123');
    
  } catch (error) {
    console.error('❌ Setup error:', error);
    process.exit(1);
  }
}

createOrUpdateTestUser();
