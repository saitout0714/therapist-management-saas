const { createClient } = require('@supabase/supabase-js');
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const anonKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24';

const supabaseAdmin = createClient(dbUrl, serviceRoleKey);
const supabaseAnon = createClient(dbUrl, anonKey);

async function test() {
  console.log('--- Fetching a therapist and a shop ---');
  const { data: therapists, error: tErr } = await supabaseAdmin.from('therapists').select('id, name, shop_id').limit(1);
  if (tErr) {
    console.error('Error fetching therapists:', tErr);
    return;
  }
  const therapist = therapists[0];
  console.log('Found therapist:', therapist);

  // Let's find a user to login as
  console.log('\n--- Fetching users ---');
  const { data: users, error: uErr } = await supabaseAdmin.from('users').select('id, login_id, role').limit(5);
  if (uErr) {
    console.error('Error fetching users:', uErr);
    return;
  }
  console.log('Users:', users);

  // Check shop owners mapping
  console.log('\n--- Fetching shop_owners ---');
  const { data: shopOwners, error: soErr } = await supabaseAdmin.from('shop_owners').select('*').limit(5);
  if (soErr) {
    console.error('Error fetching shop_owners:', soErr);
  } else {
    console.log('Shop Owners:', shopOwners);
  }

  // Let's check RLS policies on therapist_memos
  // We can query pg_policies using service role (admin) if we do direct query, but we can't do direct query easily.
  // Instead, let's try to test anon user insertion or try to log in and insert.
}

test();
