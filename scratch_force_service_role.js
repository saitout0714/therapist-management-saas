const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// SERVICE_ROLE_KEY を使用して RLS を完全にバイパスして確実に書き換える
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log('Force updating with SERVICE ROLE KEY...');
  const { data, error } = await supabase
    .from('shops')
    .update({ logo_url: '/images/logo.svg' })
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select();

  if (error) {
    console.error('Error with service role key update:', error);
  } else {
    console.log(`SUCCESS! Updated ${data.length} shops!`);
    const sg = data.find(s => s.id === '150ee036-bd95-47ab-bf50-8132d3c62bdf' || s.name.includes('SpecialGrade'));
    console.log('SpecialGrade updated record:', sg);
  }
}

run();
