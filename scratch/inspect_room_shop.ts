import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*, shops(name)')
    .eq('id', '1abfbaa9-a3c6-41b8-a743-bd6a15654f0b')
    .single();

  if (error) {
    console.error('Error fetching room:', error);
    return;
  }

  console.log('Room:', room);
}

main();
