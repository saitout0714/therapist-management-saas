const { createClient } = require('@supabase/supabase-js');

const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const dbKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';
const supabase = createClient(dbUrl, dbKey);

async function run() {
  const tables = ['courses', 'designation_types', 'options', 'therapist_ranks', 'discount_policies', 'deduction_rules'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.error(`Error fetching ${table}:`, error.message);
      } else {
        console.log(`\nTable [${table}] columns:`);
        if (data && data.length > 0) {
          console.log(Object.keys(data[0]));
        } else {
          console.log('(No records found to inspect)');
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
}

run();
