import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('*, shops(name)');

  if (error) {
    console.error('Error fetching rooms:', error);
    return;
  }

  for (const r of rooms) {
    if (r.template_member || r.template_new_customer || r.template_web_member || r.template_web_new_customer) {
      console.log(`\n===========================================`);
      console.log(`Room ID: ${r.id}`);
      console.log(`Shop: ${r.shops?.name}`);
      console.log(`Name: ${r.name}`);
      console.log(`Display Name: ${r.display_name}`);
      if (r.template_member) console.log(`--- template_member ---\n${r.template_member}`);
      if (r.template_new_customer) console.log(`--- template_new_customer ---\n${r.template_new_customer}`);
    }
  }
}

main();
