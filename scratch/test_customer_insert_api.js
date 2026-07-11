const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const supabaseAnonKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  console.log("Supabase URL:", supabaseUrl);
  
  // 1. Sign in
  console.log("Signing in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'saitou0714@yoyakl.tokyo',
    password: 'Saitou0714!'
  });

  if (authError) {
    console.error('Sign in failed:', authError.message);
    return;
  }
  console.log('Signed in! User ID:', authData.user.id);

  // 2. Insert customer to 'こころリンス浅浅橋' ('dc3caa06-fcc2-4bdc-b063-7969296efd34')
  console.log("Inserting customer...");
  const { data: custData, error: custError } = await supabase
    .from('customers')
    .insert([{
      name: 'Test Customer from API Script',
      shop_id: 'dc3caa06-fcc2-4bdc-b063-7969296efd34'
    }])
    .select();

  if (custError) {
    console.error('Customer insert failed! Error:', custError);
  } else {
    console.log('Customer insert succeeded! Customer:', custData);
    // clean up
    const { error: delError } = await supabase
      .from('customers')
      .delete()
      .eq('id', custData[0].id);
    console.log('Cleanup error (if any):', delError);
  }
}

run();
