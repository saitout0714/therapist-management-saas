import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: therapists } = await supabase
    .from('therapists')
    .select('id, name, shop_id, estama_therapist_id, esthe_ranking_therapist_id')
    .ilike('name', '%たかなし%');

  console.log('Takanashi in DB:', therapists);
}

main();
