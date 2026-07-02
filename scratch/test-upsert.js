const { createClient } = require('@supabase/supabase-js');

const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const dbKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';
const supabase = createClient(dbUrl, dbKey);

async function run() {
  const shopId = '75e69a2a-eaac-4d2f-91af-e7579c1a84ab'; // Carezza
  
  // Fetch first 2 courses
  const { data: courses, error } = await supabase
    .from('courses')
    .select('id, name, display_order')
    .eq('shop_id', shopId)
    .limit(2);

  if (error) {
    console.error('Error fetching courses:', error.message);
    return;
  }

  console.log('Original courses:', courses);

  if (courses.length < 2) {
    console.log('Not enough courses to test swap.');
    return;
  }

  // Swap their display_order values (safe swap test)
  const payload = [
    { id: courses[0].id, display_order: courses[1].display_order, shop_id: shopId },
    { id: courses[1].id, display_order: courses[0].display_order, shop_id: shopId }
  ];

  console.log('Upsert payload:', payload);

  const { data: upsertData, error: upsertError } = await supabase
    .from('courses')
    .upsert(payload)
    .select('id, name, display_order');

  if (upsertError) {
    console.error('Upsert failed:', upsertError.message);
  } else {
    console.log('Upsert success! Result:', upsertData);
  }
}

run();
