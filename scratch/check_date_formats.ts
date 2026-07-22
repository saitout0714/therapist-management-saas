import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: shifts } = await supabase.from('shifts').select('date').limit(3);
  const { data: res } = await supabase.from('reservations').select('date').limit(3);

  console.log('Shift dates:', shifts);
  console.log('Reservation dates:', res);
}

main();
