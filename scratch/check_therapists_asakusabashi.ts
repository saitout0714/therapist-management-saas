import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const shopId = 'dc3caa06-fcc2-4bdc-b063-7969296efd34'; // こころリンス浅草橋

  const { data: therapists } = await supabase
    .from('therapists')
    .select('id, name, estama_therapist_id, esthe_ranking_therapist_id')
    .eq('shop_id', shopId);

  console.log('Therapists for 浅草橋:', therapists);
}

main();
