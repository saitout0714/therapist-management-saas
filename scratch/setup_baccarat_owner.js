const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!projectUrl || !serviceRoleKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(projectUrl, serviceRoleKey);

async function setupBaccaratOwner(loginId, password, ownerName = 'バカラ オーナー', role = 'agency_client_owner') {
  const email = `${loginId}@yoyakl.tokyo`;
  const hashedPassword = await bcrypt.hash(password, 10);

  // 1. Check or create in Supabase Auth
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const existingAuthUser = usersData.users.find(u => u.email === email);
  let userId;

  if (existingAuthUser) {
    console.log(`Auth user already exists (${existingAuthUser.id}). Updating...`);
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      existingAuthUser.id,
      { password, user_metadata: { role, name: ownerName } }
    );
    if (updateError) throw updateError;
    userId = existingAuthUser.id;
  } else {
    console.log('Creating auth user...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, name: ownerName }
    });
    if (createError) throw createError;
    userId = newUser.user.id;
  }

  // 2. Sync to public.users
  const { error: syncError } = await supabase.from('users').upsert({
    id: userId,
    login_id: loginId,
    password_hash: hashedPassword,
    role: role,
    name: ownerName,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });

  if (syncError) throw syncError;

  // 3. Find the 4 Baccarat shops
  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select('id, name')
    .in('name', ['バカラ周南下松', 'バカラ山口湯田', 'バカラ宇部', 'バカラ岩国']);

  if (shopsError) throw shopsError;
  console.log('Found shops:', shops);

  // 4. Link in shop_owners
  for (const shop of shops) {
    const { data: existing } = await supabase
      .from('shop_owners')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      const { error: linkError } = await supabase
        .from('shop_owners')
        .insert([{ shop_id: shop.id, user_id: userId }]);
      if (linkError) console.error(`Error linking ${shop.name}:`, linkError);
      else console.log(`Linked ${shop.name} to user ${userId}`);
    } else {
      console.log(`${shop.name} is already linked.`);
    }
  }

  console.log('Setup complete!');
  console.log(`Login ID: ${loginId}`);
  console.log(`Password: ${password}`);
}

const args = process.argv.slice(2);
const loginId = args[0] || 'baccarat';
const password = args[1] || 'baccarat2026';

setupBaccaratOwner(loginId, password).catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
