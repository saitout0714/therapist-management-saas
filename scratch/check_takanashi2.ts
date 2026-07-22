import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: therapists, error } = await supabase
    .from('therapists')
    .select('id, name, estama_therapist_id');

  console.log(therapists?.filter(t => t.estama_therapist_id && t.estama_therapist_id.includes('856663')));
}

main();
