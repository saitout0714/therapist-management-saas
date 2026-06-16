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

  console.log('Inspecting room templates...');
  for (const r of rooms) {
    const hasEbina = [r.name, r.display_name, r.template_member, r.template_new_customer, r.template_web_member, r.template_web_new_customer]
      .some(val => val && val.includes('海老名'));
    
    if (hasEbina) {
      console.log(`\nMatch found in Room ID: ${r.id}`);
      console.log(`- Name: ${r.name}`);
      console.log(`- Display Name: ${r.display_name}`);
      console.log(`- template_member: ${r.template_member}`);
      console.log(`- template_new_customer: ${r.template_new_customer}`);
      console.log(`- template_web_member: ${r.template_web_member}`);
      console.log(`- template_web_new_customer: ${r.template_web_new_customer}`);
    }
  }
}

main();
