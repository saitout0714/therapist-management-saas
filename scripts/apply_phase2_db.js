const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.trim();
});

const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceKey);

async function run() {
  const { data: shopsData, error: shopsErr } = await supabase.from('shops').select('*').limit(1);
  console.log('Shops sample:', shopsData, shopsErr);

  const { data: storesData, error: storesErr } = await supabase.from('stores').select('*').limit(1);
  console.log('Stores sample:', storesData, storesErr);
}

run().catch(console.error);
