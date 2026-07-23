const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: shops } = await supabase.from('shops').select('*');
    console.log(shops);
    
    const { data: settings } = await supabase.from('shop_settings').select('*').eq('site_type', 'ESTAMA');
    console.log(settings);
}
run();
