require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreate(role) {
  const loginId = `test_user_${role}_${Date.now()}`;
  const email = `${loginId}@yoyakl.tokyo`;
  const password = "password1234";
  const name = `Test ${role}`;

  console.log(`\n=== TESTING CREATE USER FOR ROLE: ${role} ===`);
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });

    if (error) {
      console.error("Auth Create Error:", error);
      return;
    }

    console.log("Auth user created successfully. ID:", data.user.id);

    // Let's check if the user is successfully created in public.users table
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (dbError) {
      console.error("Database Fetch Error:", dbError);
    } else {
      console.log("Database user found:", dbUser);
    }

    // Clean up
    console.log("Cleaning up auth user...");
    const { error: deleteError } = await supabase.auth.admin.deleteUser(data.user.id);
    if (deleteError) {
      console.error("Clean up error:", deleteError);
    } else {
      console.log("Cleaned up successfully.");
    }

  } catch (err) {
    console.error("Exception occurred:", err);
  }
}

async function run() {
  await testCreate('agency_client_owner');
  await testCreate('simple_client_owner');
}

run();
