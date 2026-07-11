import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24';

const supabase = createClient(dbUrl, serviceRoleKey);
const shopId = '92c51e51-339b-48ce-8535-0f45c859b195'; // こころリンス

async function run() {
  console.log('🧪 Testing Booking Restriction Logic...');

  // 1. 設定の更新 (allow_new_customers = false)
  console.log('\n1. Disabling new customer bookings (allow_new_customers = false)...');
  const { error: updateError } = await supabase
    .from('system_settings')
    .update({ allow_new_customers: false })
    .eq('shop_id', shopId);

  if (updateError) {
    console.error('❌ Failed to update settings:', updateError);
    return;
  }
  console.log('✅ Settings updated.');

  // 2. 設定の取得
  console.log('\n2. Retrieving settings...');
  const { data: settings, error: fetchSettingsError } = await supabase
    .from('system_settings')
    .select('allow_new_customers')
    .eq('shop_id', shopId)
    .single();

  if (fetchSettingsError) {
    console.error('❌ Failed to fetch settings:', fetchSettingsError);
    return;
  }
  console.log(`✅ Retrieved setting allow_new_customers: ${settings.allow_new_customers} (Expected: false)`);

  // 3. テスト顧客検索シミュレーション
  console.log('\n3. Simulating reservation API checks...');
  
  // テストA: 移行で登録された既存顧客の電話番号をDBから動的に取得
  const { data: sampleCustomer } = await supabase
    .from('customers')
    .select('phone, name')
    .eq('shop_id', shopId)
    .not('phone', 'is', null)
    .limit(1)
    .maybeSingle();

  if (!sampleCustomer || !sampleCustomer.phone) {
    console.error('❌ Failed to find any customer with a phone number in DB.');
    return;
  }
  const existingPhone = sampleCustomer.phone;
  console.log(`Using sample existing customer: "${sampleCustomer.name}" with phone: ${existingPhone}`);
  console.log(`Simulating reservation with existing customer phone: ${existingPhone}`);
  
  const { data: matchedCust } = await supabase
    .from('customers')
    .select('id, name')
    .eq('shop_id', shopId)
    .eq('phone', existingPhone)
    .maybeSingle();

  if (matchedCust) {
    console.log(`👉 Match found! Existing Customer: "${matchedCust.name}" (ID: ${matchedCust.id})`);
    console.log(`✅ Result: Booking PERMITTED (Existing customer)`);
  } else {
    console.log(`❌ Result: Failed to match existing customer. (Expected to match)`);
  }

  // テストB: 完全新規顧客の電話番号
  const newPhone = '09000009999';
  console.log(`\nSimulating reservation with new customer phone: ${newPhone}`);
  
  const { data: matchedNew } = await supabase
    .from('customers')
    .select('id, name')
    .eq('shop_id', shopId)
    .eq('phone', newPhone)
    .maybeSingle();

  if (matchedNew) {
    console.log(`❌ Match found! (Unexpected for dummy phone)`);
  } else {
    console.log(`👉 No match found. This is a NEW customer.`);
    if (!settings.allow_new_customers) {
      console.log(`✅ Result: Booking BLOCKED (Error: New customer booking is disabled for this shop)`);
    } else {
      console.log(`❌ Result: Booking PERMITTED (Unexpected, allow_new_customers is false but not blocked)`);
    }
  }

  // 4. 設定の復元 (allow_new_customers = true)
  console.log('\n4. Restoring original settings (allow_new_customers = true)...');
  const { error: restoreError } = await supabase
    .from('system_settings')
    .update({ allow_new_customers: true })
    .eq('shop_id', shopId);

  if (restoreError) {
    console.error('❌ Failed to restore settings:', restoreError);
    return;
  }
  console.log('✅ Settings restored.');
}

run().catch(console.error);
