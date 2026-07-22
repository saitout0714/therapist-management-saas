import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: shifts, error } = await supabase
    .from('shifts')
    .select(`
      id,
      therapist_id,
      start_time,
      end_time,
      date,
      therapists!inner (
        id,
        name,
        estama_therapist_id
      )
    `)
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Shift sample:', JSON.stringify(shifts[0], null, 2));
}

main();
