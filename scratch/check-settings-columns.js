const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(dbUrl, dbKey);

async function run() {
  try {
    const { data, error } = await supabase.from('system_settings').select('*').limit(1);
    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log('system_settings columns:', Object.keys(data[0] || {}));
    }
  } catch (err) {
    console.error(err);
  }
}

run();
