const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const updates = [
    { name: 'バカラ周南下松', short_name: '周南' },
    { name: 'バカラ山口湯田', short_name: '湯田' },
    { name: 'バカラ宇部', short_name: '宇部' },
    { name: 'バカラ岩国', short_name: '岩国' },
  ];

  for (const item of updates) {
    const { error } = await supabase
      .from('shops')
      .update({ short_name: item.short_name })
      .eq('name', item.name);

    if (error) {
      console.error(`Failed to update ${item.name}:`, error);
    } else {
      console.log(`✅ Set short_name='${item.short_name}' for ${item.name}`);
    }
  }
}

run();
