const { createClient } = require('@supabase/supabase-js');
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const dbKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';
const supabase = createClient(dbUrl, dbKey);
async function run() {
  const { data, error } = await supabase.from('reservations').select(`
     *,
     customers(name, phone, email),
     courses(name, duration, base_price),
     therapists!reservations_therapist_id_fkey(name),
     reservation_options(
       options(name, price, duration)
     )
  `).limit(1);
  console.log('Error:', error);
  console.log('DataKeys:', data ? Object.keys(data[0]) : null);
}
run();
