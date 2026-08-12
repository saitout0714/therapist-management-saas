const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: shops, error: shopErr } = await supabase
    .from('shops')
    .select('id, name, slug')
    .or('slug.eq.onyankospa,name.ilike.%おニャンこ%');

  if (shopErr || !shops || shops.length === 0) {
    console.error('Shop not found!', shopErr);
    return;
  }

  const shopId = shops[0].id;
  console.log(`Updating shop ${shops[0].name} (${shopId})...`);

  const fullAddress = '東京都豊島区南大塚2丁目33-6 ライトハウス';
  const postalAddress = '〒170-0005 東京都豊島区南大塚2丁目33-6 ライトハウス';

  // 1. Update shops table
  const { error: updateShopErr } = await supabase
    .from('shops')
    .update({
      address: fullAddress,
      access_info: '大塚駅徒歩圏内 / 東京都豊島区南大塚2-33-6 ライトハウス',
      business_hours: '11:00〜28:00 (受付 10:00〜26:00)',
      updated_at: new Date().toISOString()
    })
    .eq('id', shopId);

  if (updateShopErr) console.error('Error updating shop:', updateShopErr);
  else console.log('✓ Shops table updated.');

  // 2. Update courses
  await supabase.from('courses').delete().eq('shop_id', shopId);

  const newCourses = [
    {
      shop_id: shopId,
      name: '80分コース',
      duration: 80,
      base_price: 16000,
      description: '80分 16,000円',
      is_active: true,
      display_order: 0,
      show_on_hp: true,
      show_on_timechart: true,
      category_name: 'Standard Onyanko Aroma'
    },
    {
      shop_id: shopId,
      name: '100分コース',
      duration: 100,
      base_price: 20000,
      description: '100分 20,000円',
      is_active: true,
      display_order: 1,
      show_on_hp: true,
      show_on_timechart: true,
      category_name: 'Standard Onyanko Aroma'
    },
    {
      shop_id: shopId,
      name: '120分コース',
      duration: 120,
      base_price: 24000,
      description: '120分 24,000円',
      is_active: true,
      display_order: 2,
      show_on_hp: true,
      show_on_timechart: true,
      category_name: 'Standard Onyanko Aroma'
    }
  ];

  const { error: courseErr } = await supabase.from('courses').insert(newCourses);
  if (courseErr) console.error('Error inserting courses:', courseErr);
  else console.log('✓ Courses updated.');

  // 3. Update system_settings (Extension: 30min 7000yen)
  const { data: existingSys } = await supabase.from('system_settings').select('id').eq('shop_id', shopId).maybeSingle();

  const sysPayload = {
    shop_id: shopId,
    extension_unit_minutes: 30,
    extension_unit_price: 7000,
    default_nomination_fee: 2000,
    default_confirmed_nomination_fee: 2000,
    default_princess_reservation_fee: 2000,
    updated_at: new Date().toISOString()
  };

  if (existingSys) {
    const { error: sysErr } = await supabase.from('system_settings').update(sysPayload).eq('shop_id', shopId);
    if (sysErr) console.error('Error updating system_settings:', sysErr);
    else console.log('✓ system_settings updated.');
  } else {
    const { error: sysErr } = await supabase.from('system_settings').insert(sysPayload);
    if (sysErr) console.error('Error inserting system_settings:', sysErr);
    else console.log('✓ system_settings inserted.');
  }

  // 4. Update options
  await supabase.from('options').delete().eq('shop_id', shopId);

  const newOptions = [
    {
      shop_id: shopId,
      name: '各種オプション',
      price: 1000,
      description: 'オプション1,000円〜',
      is_active: true,
      display_order: 0,
      option_type: 'treatment',
      duration_minutes_added: 0,
      show_on_hp: true
    }
  ];

  const { error: optionErr } = await supabase.from('options').insert(newOptions);
  if (optionErr) console.error('Error inserting options:', optionErr);
  else console.log('✓ Options updated.');

  // 5. Update designation_types
  await supabase.from('designation_types').delete().eq('shop_id', shopId);

  const newDesignationTypes = [
    {
      shop_id: shopId,
      slug: 'free',
      display_name: 'フリー',
      default_fee: 0,
      default_back_amount: 0,
      display_order: 0,
      is_active: true,
      show_on_hp: true
    },
    {
      shop_id: shopId,
      slug: 'photo_nomination',
      display_name: '写真指名',
      default_fee: 1000,
      default_back_amount: 0,
      display_order: 1,
      is_active: true,
      show_on_hp: true
    },
    {
      shop_id: shopId,
      slug: 'confirmed',
      display_name: '本指名',
      default_fee: 2000,
      default_back_amount: 0,
      display_order: 2,
      is_active: true,
      show_on_hp: true
    },
    {
      shop_id: shopId,
      slug: 'princess',
      display_name: '姫予約',
      default_fee: 2000,
      default_back_amount: 0,
      display_order: 3,
      is_active: true,
      show_on_hp: true
    }
  ];

  const { error: desigErr } = await supabase.from('designation_types').insert(newDesignationTypes);
  if (desigErr) console.error('Error inserting designation_types:', desigErr);
  else console.log('✓ Designation types updated.');

  // 6. Update rooms
  await supabase.from('rooms').delete().eq('shop_id', shopId);

  const newRooms = [
    {
      shop_id: shopId,
      name: '406号室',
      display_name: '406号室',
      address: `${fullAddress} 406号室`,
      google_map_url: `https://maps.google.com/?q=${encodeURIComponent(fullAddress + ' 406号室')}`,
      order: 1,
      memo: `${postalAddress} 406号室`,
      type: 'room'
    },
    {
      shop_id: shopId,
      name: '703号室',
      display_name: '703号室',
      address: `${fullAddress} 703号室`,
      google_map_url: `https://maps.google.com/?q=${encodeURIComponent(fullAddress + ' 703号室')}`,
      order: 2,
      memo: `${postalAddress} 703号室`,
      type: 'room'
    }
  ];

  const { error: roomErr } = await supabase.from('rooms').insert(newRooms);
  if (roomErr) console.error('Error inserting rooms:', roomErr);
  else console.log('✓ Rooms updated.');

  console.log('Finished DB updates for おニャンこスパ!');
}

main();
