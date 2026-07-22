import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { syncShiftsToEstama } from './lib/sync/estama';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const shopId = 'dc3caa06-fcc2-4bdc-b063-7969296efd34'; // こころリンス浅草橋
  const startDate = '2026-07-22';
  const endDate = '2026-08-04';

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single();

  const { data: shifts } = await supabase
    .from('shifts')
    .select(`
      id, therapist_id, start_time, end_time, date,
      therapists!inner (id, name, estama_therapist_id, esthe_ranking_therapist_id)
    `)
    .eq('shop_id', shopId)
    .gte('date', startDate)
    .lte('date', endDate);

  const { data: reservations, error: resError } = await supabase
    .from('reservations')
    .select(`
      id, therapist_id, start_time, end_time, date,
      therapists!inner (id, name, estama_therapist_id, esthe_ranking_therapist_id)
    `)
    .eq('shop_id', shopId)
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('status', 'cancelled');

  if (resError) console.error('Reservations Error:', resError);

  console.log('Shifts count:', shifts?.length);
  console.log('Reservations count:', reservations?.length);
  
  if (reservations) {
     const tRes = reservations.filter(r => r.therapists?.name === 'たかなし' || r.therapists?.estama_therapist_id === '856663' || r.date === '2026-07-23');
     console.log('Takanashi Reservations:', tRes);
  }

  // console.log('Starting sync...');
  // await syncShiftsToEstama(
  //   shop.hp_url || 'https://estama.jp/admin/schedule/',
  //   shop.estama_login_id,
  //   shop.estama_password,
  //   startDate,
  //   endDate,
  //   shifts || [],
  //   reservations || []
  // );
}

main();
