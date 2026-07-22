import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: therapist, error } = await supabase
    .from('therapists')
    .select('id, name, estama_therapist_id')
    .eq('estama_therapist_id', '856663')
    .single();

  console.log('Therapist:', therapist);
  if (therapist) {
    const { data: res } = await supabase
      .from('reservations')
      .select('*')
      .eq('therapist_id', therapist.id)
      .eq('date', '2026-07-22');
    console.log('Reservations:', res);
  }
}

main();
