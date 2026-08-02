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
  const { data: shops } = await supabase.from('shops').select('id, name').ilike('name', '%辻堂%');
  if (!shops || shops.length === 0) return;
  const shopId = shops[0].id;

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, therapists(name)')
    .eq('shop_id', shopId);

  console.log('All shifts for 辻堂茅ヶ崎:', shifts);
}

run().catch(console.error);
