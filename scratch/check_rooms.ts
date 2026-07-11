import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // use service role to read all shops/rooms

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching therapists for rabbit_tachikawa from Supabase...')
  const { data: therapists, error } = await supabase
    .from('therapists')
    .select('id, name')
    .eq('shop_id', 'a0000001-0000-0000-0000-000000000003')
  
  if (error || !therapists) {
    console.error('Failed to fetch therapists:', error)
    return
  }

  console.log(`Fetched ${therapists.length} therapists for rabbit_tachikawa:`)
  therapists.forEach(t => {
    console.log(`- ${t.name} (UUID: ${t.id})`)
  })
}

main();
