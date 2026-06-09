const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase environment variables are missing in .env.local');
  process.exit(1);
}

// Create Supabase client with Service Role Key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function listAuthUsers() {
  console.log('Connecting to Supabase auth with service role...');
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('Error listing auth users:', error);
    } else {
      console.log('Successfully listed auth users. Count:', users.length);
      users.forEach(u => {
        console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.user_metadata?.role}, CreatedAt: ${u.created_at}`);
      });
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

listAuthUsers();
