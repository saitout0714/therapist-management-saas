const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: photos } = await supabase
      .from('therapist_photos')
      .select('*')
      .eq('therapist_id', 'efa75b28-06da-4238-8d1c-d2c07e12b8aa')
      .order('display_order', { ascending: true });
    console.log('Photos for Saitou Oreiko:', JSON.stringify(photos, null, 2));
}
run();
