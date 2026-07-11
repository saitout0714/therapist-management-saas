const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Key is missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: authUsers, error: authError } = await supabase
    .auth.admin.listUsers();

  if (authError) {
    console.error("Error listing auth users:", authError);
  } else {
    console.log("Auth Users:");
    console.log(authUsers.users.map(u => ({ id: u.id, email: u.email })));
  }
  
}

check();
