const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase.from('system_settings').select('*').limit(1);
  if (error) {
    console.error('Error fetching system_settings:', error);
  } else {
    console.log('System settings columns:', Object.keys(data[0] || {}));
    console.log('First row data:', data[0]);
  }
}

main().catch(console.error);
