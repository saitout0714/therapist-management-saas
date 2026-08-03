const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Force updating all shops logo_url to /images/logo.svg...');
  const { data, error } = await supabase
    .from('shops')
    .update({ logo_url: '/images/logo.svg' })
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select();

  if (error) {
    console.error('Error updating shops:', error);
  } else {
    console.log(`Successfully updated ${data.length} shops!`);
    const sg = data.find(s => s.id === '150ee036-bd95-47ab-bf50-8132d3c62bdf' || s.name.includes('SpecialGrade'));
    console.log('SpecialGrade updated record:', sg);
  }
}

run();
