import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // use service role to read all shops/rooms

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('*');

  if (error) {
    console.error('Error fetching rooms:', error);
    return;
  }

  console.log('Rooms in database:', rooms.length);
  for (const r of rooms) {
    console.log(`- Room ID: ${r.id}, Name: ${r.name}, Display Name: ${r.display_name}`);
    console.log(`  template_member: ${r.template_member ? 'Set' : 'Null'}`);
    console.log(`  template_new_customer: ${r.template_new_customer ? 'Set' : 'Null'}`);
    console.log(`  template_web_member: ${r.template_web_member ? 'Set' : 'Null'}`);
    console.log(`  template_web_new_customer: ${r.template_web_new_customer ? 'Set' : 'Null'}`);
  }
}

main();
