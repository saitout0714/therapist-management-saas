import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { syncShiftsToEstama } from '../lib/sync/estama';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const shopId = 'dc3caa06-fcc2-4bdc-b063-7969296efd34'; // こころリンス浅草橋
  
  const today = new Date();
  const startDate = today.toISOString().split('T')[0];
  const future = new Date(today);
  future.setDate(future.getDate() + 13);
  const endDate = future.toISOString().split('T')[0];

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

  const { data: reservations } = await supabase
    .from('reservations')
    .select(`
      id, therapist_id, start_time, end_time, date
    `)
    .eq('shop_id', shopId)
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('status', 'cancelled');

  console.log('Shifts:', shifts?.length);
  console.log('Reservations:', reservations?.length);
  
  if (reservations) {
    console.log('Sample reservation:', reservations[0]);
  }

  console.log('Running syncShiftsToEstama...');
  try {
    const result = await syncShiftsToEstama(
      shop.hp_url || 'https://estama.jp/admin/schedule/',
      shop.estama_login_id,
      shop.estama_password,
      startDate,
      endDate,
      shifts || [],
      reservations || []
    );
    console.log('Sync Result:', result);
  } catch (err) {
    console.error('Sync failed:', err);
  }
}

main();
