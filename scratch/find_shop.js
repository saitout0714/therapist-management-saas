const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase URL or Service Role Key is missing in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findShop() {
  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, name, short_name');
  
  if (error) {
    console.error("Error fetching shops:", error);
    return;
  }
  
  console.log("=== SHOP LIST ===");
  shops.forEach(s => {
    console.log(`ID: ${s.id} | Name: ${s.name} | ShortName: ${s.short_name}`);
  });
}

findShop();
