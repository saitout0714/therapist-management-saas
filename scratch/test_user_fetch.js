const { createClient } = require('@supabase/supabase-js');
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const anonKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';

const supabase = createClient(dbUrl, anonKey);

async function run() {
  const targetUserId = 'd2042d7e-16cc-46fa-a55f-75bb88e051b5'; // saitou0714

  console.log('1. Fetching user without login...');
  const { data: data1, error: error1 } = await supabase
    .from('users')
    .select('*')
    .eq('id', targetUserId);

  console.log('Result (unauthenticated):', data1);
  console.log('Error (unauthenticated):', error1);

  console.log('\n2. Signing in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'saitou0714@yoyakl.tokyo',
    password: 'Saitou0714!'
  });

  if (authError) {
    console.error('Sign in failed:', authError.message);
    return;
  }
  console.log('Signed in! User ID:', authData.user.id);

  console.log('\n3. Fetching user with active session...');
  const { data: data2, error: error2 } = await supabase
    .from('users')
    .select('*')
    .eq('id', targetUserId);

  console.log('Result (authenticated):', data2);
  console.log('Error (authenticated):', error2);
}

run();
