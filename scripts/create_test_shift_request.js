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
  console.log('Creating a test shift request...');

  // 1. Get Special Grade shop
  const { data: shop } = await supabase.from('shops').select('id, name').limit(1).single();
  if (!shop) {
    console.error('No shop found');
    return;
  }

  // 2. Get a therapist
  const { data: therapist } = await supabase.from('therapists').select('id, name').limit(1).single();
  if (!therapist) {
    console.error('No therapist found');
    return;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  // 3. Insert requested shift
  const { data: inserted, error } = await supabase.from('shifts').insert({
    shop_id: shop.id,
    therapist_id: therapist.id,
    date: dateStr,
    start_time: '14:00:00',
    end_time: '22:00:00',
    room_id: null,
    notes: '【テスト希望データ】14:00〜22:00で出勤希望です！よろしくお願いいたします。',
  }).select();

  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log(`✅ Created test shift request for ${therapist.name} on ${dateStr}!`);
  }
}

run().catch(console.error);
