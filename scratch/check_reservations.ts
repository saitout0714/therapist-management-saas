import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const shopId = '774101be-d8c5-4ca5-ba4a-fc61c039fbaa'; // estama shop id? wait, let's just query by therapist_id or date!
  
  const { data, error } = await supabase
    .from('reservations')
    .select('id, start_time, end_time, date, status, therapist_id, shop_id')
    .eq('date', '2026-07-22');

  console.log('Reservations on 7/22:');
  console.dir(data, { depth: null });
}

main();
