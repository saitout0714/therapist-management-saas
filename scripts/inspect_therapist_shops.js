const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.trim();
});

const url = envVars.NEXT_PUBLIC_SUPABASE_URL || 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, serviceKey);

async function run() {
  // 1. Get 辻堂茅ヶ崎 shop
  const { data: shops } = await supabase.from('shops').select('id, name').ilike('name', '%辻堂%');
  console.log('Shops matching 辻堂:', shops);

  if (!shops || shops.length === 0) return;
  const shopId = shops[0].id;

  // 2. Fetch therapists for this shop
  const { data: tsData } = await supabase
    .from('therapist_shops')
    .select('*')
    .eq('shop_id', shopId);
  console.log('therapist_shops sample for shop:', tsData?.slice(0, 3));

  const { data: therapists } = await supabase
    .from('therapists')
    .select('id, name, order, is_active')
    .eq('shop_id', shopId);
  console.log('therapists for shop:', therapists);
}

run().catch(console.error);
