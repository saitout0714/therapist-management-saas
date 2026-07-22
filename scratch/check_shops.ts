import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('shops')
    .select('id, name, needs_sync, estama_login_id');
    
  console.log('Shops status:', data?.filter(s => s.name.includes('こころリンス')));
}
main();
