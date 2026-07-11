const { createClient } = require('@supabase/supabase-js');
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const anonKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24';

const supabaseAdmin = createClient(dbUrl, serviceRoleKey);
const supabaseAnon = createClient(dbUrl, anonKey);

async function run() {
  const userId = '54937a7d-db59-42b8-8b00-d10a63e33542'; // 123456 (agency_client_owner)
  const email = '123456@yoyakl.tokyo';
  const password = 'debugpassword123';

  console.log('1. Updating user password to debug password...');
  const { data: user, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: password
  });

  if (updateErr) {
    console.error('Failed to update user password:', updateErr);
    return;
  }
  console.log('Password updated successfully for user:', user.user.email);

  console.log('\n2. Signing in as user via supabaseAnon...');
  const { data: authData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
    email,
    password
  });

  if (signInErr) {
    console.error('Sign in failed:', signInErr);
    return;
  }
  console.log('Signed in successfully! Session user ID:', authData.user.id);

  // Use the signed in client
  const authenticatedClient = createClient(dbUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  // Set the session manually
  await authenticatedClient.auth.setSession(authData.session);

  console.log('\n3. Fetching target therapist and shop...');
  const { data: therapists, error: tErr } = await supabaseAdmin.from('therapists').select('id, name, shop_id').limit(1);
  if (tErr || !therapists || therapists.length === 0) {
    console.error('Failed to get therapist:', tErr);
    return;
  }
  const therapist = therapists[0];
  console.log(`Using Therapist: ${therapist.name} (${therapist.id}), Shop: ${therapist.shop_id}`);

  console.log('\n4. Attempting to insert therapist memo with authenticated client...');
  const insertPayload = {
    therapist_id: therapist.id,
    shop_id: therapist.shop_id,
    date: new Date().toISOString().split('T')[0],
    content: 'Test RLS memo insertion (owner)',
    amount: 1234,
  };
  console.log('Payload:', insertPayload);

  const { data: insertRes, error: insertErr } = await authenticatedClient
    .from('therapist_memos')
    .insert([insertPayload])
    .select();

  if (insertErr) {
    console.error('Insert failed!');
    console.error('Error Code:', insertErr.code);
    console.error('Error Message:', insertErr.message);
    console.error('Error Details:', insertErr.details);
    console.error('Error Hint:', insertErr.hint);
  } else {
    console.log('Insert succeeded! Result:', insertRes);
    // Cleanup
    if (insertRes && insertRes.length > 0) {
      const { error: delErr } = await authenticatedClient
        .from('therapist_memos')
        .delete()
        .eq('id', insertRes[0].id);
      if (delErr) {
        console.error('Cleanup failed:', delErr);
      } else {
        console.log('Cleanup succeeded.');
      }
    }
  }
}

run();
