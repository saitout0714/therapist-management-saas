const { createClient } = require('@supabase/supabase-js');
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24';
const supabase = createClient(dbUrl, serviceRoleKey);

async function run() {
  console.log('=== SHOPS ===');
  const { data: shops, error: shopsErr } = await supabase.from('shops').select('*');
  if (shopsErr) console.error(shopsErr);
  else console.log(shops.map(s => ({ id: s.id, name: s.name, is_active: s.is_active })));

  console.log('\n=== USERS ===');
  const { data: users, error: usersErr } = await supabase.from('users').select('*');
  if (usersErr) console.error(usersErr);
  else console.log(users.map(u => ({ id: u.id, login_id: u.login_id, name: u.name, role: u.role })));

  console.log('\n=== SHOP OWNERS ===');
  const { data: shopOwners, error: soErr } = await supabase.from('shop_owners').select('*');
  if (soErr) console.error(soErr);
  else console.log(shopOwners);
}
run();
