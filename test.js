const { createClient } = require('@supabase/supabase-js');
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const dbKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';
const supabase = createClient(dbUrl, dbKey);
async function run() {
  const { data, error } = await supabase.from('reservations').select(`
     *,
     customers(name, phone, email),
     courses(name, duration, base_price),
     therapists(name),
     reservation_options(
       options(name, price, duration)
     )
  `).limit(1);
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));

  // now check shift
  if (data && data[0]) {
    const r = data[0];
    const { data: shiftData, error: shiftError } = await supabase
        .from('shifts')
        .select(`
          rooms(name, address)
        `)
        .eq('therapist_id', r.therapist_id)
        .eq('date', r.date)
        .eq('shop_id', r.shop_id)
        .maybeSingle()
    console.log('ShiftError:', shiftError);
    console.log('ShiftData:', JSON.stringify(shiftData, null, 2));
  }
}
run();
