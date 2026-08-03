const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: shops, error } = await supabase.from('shops').select('*');
  console.log('Error:', error);
  console.log('Shops count:', shops ? shops.length : 0);
  if (shops) {
    console.log('First 5 shops:', shops.slice(0, 5).map(s => ({ id: s.id, name: s.name, slug: s.slug, logo_url: s.logo_url })));
  }
}

run();
