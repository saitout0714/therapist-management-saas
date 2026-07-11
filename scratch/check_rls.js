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
  console.log('--- Development Database ---');
  const { data: codes, error } = await supabase.from('shop_reservation_codes').select('*');
  console.log('shop_reservation_codes:', codes, 'error:', error);

  const { data: shops, error: shopsErr } = await supabase.from('shops').select('id, name');
  console.log('shops:', shops, 'error:', shopsErr);
}

runTest();
