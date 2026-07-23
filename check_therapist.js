const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: t } = await supabase.from('therapists').select('*').eq('id', 'efa75b28-06da-4238-8d1c-d2c07e12b8aa').single();
    console.log('Therapist:', JSON.stringify(t, null, 2));

    const { data: jobs } = await supabase.from('sync_jobs').select('*').order('created_at', { ascending: false }).limit(10);
    console.log('Recent Sync Jobs:', JSON.stringify(jobs, null, 2));
}
run();
