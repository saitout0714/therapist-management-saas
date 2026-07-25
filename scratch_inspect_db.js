const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectShopsAndOwners() {
  console.log("--- OWNERS ---");
  const { data: owners, error: ownerErr } = await supabase.from('owners').select('*');
  console.log(owners || ownerErr);

  console.log("--- SHOPS ---");
  const { data: shops, error: shopErr } = await supabase.from('shops').select('id, name, owner_id');
  console.log(shops || shopErr);

  console.log("--- CUSTOMERS BY SHOP ---");
  const { data: customers, error: custErr } = await supabase.from('customers').select('id, name, shop_id, owner_id').limit(20);
  console.log(customers || custErr);
}

inspectShopsAndOwners();
