import { createClient } from '@supabase/supabase-js';
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24';
const supabase = createClient(dbUrl, serviceRoleKey);

async function run() {
  console.log('=== CUSTOMERS SCHEMA ===');
  const { data: customers, error } = await supabase.from('customers').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log(customers[0] ? Object.keys(customers[0]) : 'No customers found');
    console.log('Sample record:', customers[0]);
  }
}
run();
