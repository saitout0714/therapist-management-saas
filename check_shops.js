const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pumkniqtgjsotsxhyvbq.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('shop_reservation_codes').select('code, shop_id, shops(name)');
  console.log(JSON.stringify(data, null, 2));
}
run();
