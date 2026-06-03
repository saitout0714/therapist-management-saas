const { createClient } = require('@supabase/supabase-js');
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24';
const supabase = createClient(dbUrl, serviceKey);

async function run() {
  const { data: users, error } = await supabase.from('users').select('*');
  console.log('Error:', error);
  console.log('Users:', users);
}
run();
