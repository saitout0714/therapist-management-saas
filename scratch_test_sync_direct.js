const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSync() {
  const shop_id = '150ee036-bd95-47ab-bf50-8132d3c62bdf';
  const date_from = '2026-08-01';
  const date_to = '2026-08-10';

  const [shiftsRes, coursesRes, reservationsRes] = await Promise.all([
    supabase
      .from('shifts')
      .select(`
        id,
        date,
        start_time,
        end_time,
        notes,
        therapists (id, name, comment, photo_url),
        rooms (id, name)
      `)
      .eq('shop_id', shop_id)
      .gte('date', date_from)
      .lte('date', date_to)
      .order('date', { ascending: true }),
    supabase
      .from('courses')
      .select('duration')
      .eq('shop_id', shop_id)
      .eq('is_active', true),
    supabase
      .from('reservations')
      .select('therapist_id, date, start_time, end_time, status')
      .eq('shop_id', shop_id)
      .gte('date', date_from)
      .lte('date', date_to)
  ]);

  console.log('Shifts fetched:', shiftsRes.data ? shiftsRes.data.length : 0);
  console.log('Courses fetched:', coursesRes.data ? coursesRes.data.length : 0);
  console.log('Reservations fetched:', reservationsRes.data ? reservationsRes.data.length : 0);

  if (shiftsRes.data && shiftsRes.data.length > 0) {
    console.log('Sample Shift:', JSON.stringify(shiftsRes.data[0], null, 2));
  }
}

testSync();
