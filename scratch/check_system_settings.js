const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const shopId = '5e329003-d789-4d07-a837-b7da7c5e75fa';
  
  const { data: sysSettings } = await supabase.from('system_settings').select('*').eq('shop_id', shopId);
  console.log('System Settings:', JSON.stringify(sysSettings, null, 2));
}

main();
