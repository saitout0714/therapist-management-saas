
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching from reservations:', error);
    return;
  }

  if (data && data.length >= 0) {
    console.log('Successfully connected to reservations table.');
    // In some environments, we can't see the columns easily if data is empty.
    // But Supabase JS doesn't have a way to describe table easily without RPC.
    // Let's try to insert a dummy record with only a few fields and see if it works.
    console.log('Sample record keys:', data[0] ? Object.keys(data[0]) : 'No records found');
  }
}

checkSchema();
