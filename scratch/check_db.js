const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('--- serviceClient での customer_therapist_ng テーブルセレクトテスト ---');
  const { data, error } = await serviceClient.from('customer_therapist_ng').select('*').limit(1);
  if (error) {
    console.error('エラー発生:', error);
  } else {
    console.log('セレクト成功:', data);
  }
}

main().catch(console.error);
