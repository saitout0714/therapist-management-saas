
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumnTypes() {
  const { data, error } = await supabase.rpc('get_column_info', { table_name: 'reservations' });

  if (error) {
    // If RPC doesn't exist, try a simple query to information_schema via a trick or just assume.
    // Since we can't run arbitrary SQL via the client easily without RPC, let's try to 
    // catch a specific error by sending a "25:40" time.
    console.log('RPC get_column_info not found, trying manual probe...');
    
    const { error: insertError } = await supabase
      .from('reservations')
      .insert([{
        date: '2026-04-05',
        start_time: '25:40',
        end_time: '26:40',
        therapist_id: '1cf0fb5f-accb-48ca-baf3-a050ad0ef8df', // valid UUID format
        shop_id: 'a0000001-0000-0000-0000-000000000001'
      }]);
    
    if (insertError) {
      console.log('Probe Insert Error:', insertError);
    } else {
      console.log('Probe Insert Succeeded! 25:40 is allowed.');
    }
    return;
  }

  console.log('Column Info:', data);
}

checkColumnTypes();
