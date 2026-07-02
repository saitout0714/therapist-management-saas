const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing keys in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c';
  console.log("Querying options using ANON client...");

  const { data, error } = await supabase
    .from('options')
    .select('id, name, price, back_amount, back_category')
    .eq('shop_id', shopId);

  if (error) {
    console.error("Query error:", error);
  } else {
    console.log("Query success! Data:");
    console.log(data);
  }
}

main();
