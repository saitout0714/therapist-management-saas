const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runTest() {
  console.log('1. Signing in as admin...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@yoyakl.tokyo',
    password: 'admin123'
  });

  if (authError) {
    console.error('Sign in failed:', authError.message);
    return;
  }
  console.log('Sign in succeeded! User ID:', authData.user.id);

  console.log('2. Trying upsert...');
  const { data, error } = await supabase
    .from('shop_reservation_codes')
    .upsert({
      shop_id: '92c51e51-339b-48ce-8535-0f45c859b195',
      code: 'tujidou1234',
      is_active: true
    }, { onConflict: 'shop_id' })
    .select();

  console.log('Upsert Result data:', data);
  console.log('Upsert Result error:', error);
}

runTest();
