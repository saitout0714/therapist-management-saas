const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getUserEmail() {
  const { data: users, error } = await supabase.from('users').select('*').limit(5);
  console.log("users table:", users || error);

  // shop_owners もチェック
  const { data: shopOwners } = await supabase.from('shop_owners').select('user_id, shop_id, shops(name)').limit(5);
  console.log("shop_owners:", shopOwners);
}

getUserEmail();
