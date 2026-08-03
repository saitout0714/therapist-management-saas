const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const { data } = await supabase
    .from('shops')
    .select('*')
    .ilike('name', '%SpecialGrade%')
    .single();

  console.log('Final SpecialGrade record via ANON KEY:', {
    id: data.id,
    name: data.name,
    logo_url: data.logo_url,
    theme_color: data.theme_color
  });
}

test();
