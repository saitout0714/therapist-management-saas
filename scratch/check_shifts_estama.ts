import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: shifts } = await supabase
    .from('shifts')
    .select(`
      id,
      therapist_id,
      therapists!inner (
        id,
        name,
        estama_therapist_id
      )
    `)
    .eq('shop_id', 'dc3caa06-fcc2-4bdc-b063-7969296efd34');

  const withEstama = shifts?.filter((s: any) => s.therapists?.estama_therapist_id);
  console.log('Total shifts:', shifts?.length);
  console.log('Shifts with estama_therapist_id:', withEstama?.length);
  if (withEstama && withEstama.length > 0) {
    console.log('Sample therapist with estama_therapist_id:', withEstama[0]);
  }
}

main();
