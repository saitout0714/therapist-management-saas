const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: shops } = await supabase.from('shops').select('*');
    console.log('Shops:', JSON.stringify(shops, null, 2));
    
    const { data: settings } = await supabase.from('shop_settings').select('*');
    console.log('Shop Settings:', JSON.stringify(settings, null, 2));
}
run();
