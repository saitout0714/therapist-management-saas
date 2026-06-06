const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing connection to Supabase:', supabaseUrl);
  
  // Try calling exec_sql with sql_query parameter
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
  });
  
  if (error) {
    console.error('Error with sql_query:', error.message);
    
    // Try calling exec_sql with sql parameter
    console.log('Trying with "sql" parameter...');
    const { data: data2, error: error2 } = await supabase.rpc('exec_sql', {
      sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    });
    
    if (error2) {
      console.error('Error with sql:', error2.message);
    } else {
      console.log('Success with "sql" parameter! Tables:', data2);
    }
  } else {
    console.log('Success with "sql_query" parameter! Tables:', data);
  }
}

test();
