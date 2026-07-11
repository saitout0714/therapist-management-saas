const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function runTest() {
  console.log('1. Signing in as admin...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@yoyakl.tokyo',
    password: 'admin123'
  });

  if (authError) {
    console.error('Sign in failed:', authError.message);
    return;
  }

  console.log('Sign in succeeded! User ID:', authData.user.id);

  // Use the authenticated supabase client
  console.log('2. Fetching baseline data...');
  const { data: shops } = await supabase.from('shops').select('id, name').limit(1);
  const { data: therapists } = await supabase.from('therapists').select('id, name').limit(1);
  const { data: courses } = await supabase.from('courses').select('id, name, base_price').limit(1);

  if (!shops?.length || !therapists?.length || !courses?.length) {
    console.error('Missing baseline data. Shops:', shops, 'Therapists:', therapists, 'Courses:', courses);
    return;
  }

  const shop = shops[0];
  const therapist = therapists[0];
  const course = courses[0];

  console.log(`Using Shop: ${shop.name} (${shop.id})`);
  console.log(`Using Therapist: ${therapist.name} (${therapist.id})`);
  console.log(`Using Course: ${course.name} (${course.id})`);

  console.log('3. Inserting temporary customer...');
  const { data: customerData, error: custError } = await supabase
    .from('customers')
    .insert([{
      name: 'Test Customer Admin',
      shop_id: shop.id,
      status: '予約可'
    }])
    .select();

  if (custError) {
    console.error('Customer insert failed:', custError);
    return;
  }

  const customerId = customerData[0].id;
  console.log('Temporary customer created:', customerId);

  console.log('4. Attempting to insert reservation...');
  const testRow = {
    shop_id: shop.id,
    therapist_id: therapist.id,
    customer_id: customerId,
    course_id: course.id,
    date: '2026-06-10',
    start_time: '12:00',
    end_time: '13:00',
    status: 'confirmed',
    base_price: course.base_price,
    options_price: 0,
    nomination_fee: 0,
    total_price: course.base_price,
    discount_amount: 0,
    designation_type: 'free',
    notes: 'Admin Test insert',
    created_by_id: authData.user.id,
    reception_source: 'staff',
    payment_method: 'cash',
    options_payment_method: 'cash',
    credit_fee_amount: 0,
    is_hime: false,
    hime_bonus: 0
  };

  const { data: resData, error: resError } = await supabase
    .from('reservations')
    .insert([testRow])
    .select();

  // Cleanup customer
  await supabase.from('customers').delete().eq('id', customerId);

  if (resError) {
    console.error('Reservation insert failed! Error:', resError);
  } else {
    console.log('Reservation insert succeeded! ID:', resData[0].id);
    // Cleanup reservation
    await supabase.from('reservations').delete().eq('id', resData[0].id);
    console.log('Cleaned up reservation.');
  }
}

runTest();
