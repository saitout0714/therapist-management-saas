const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getBaccaratUser() {
  const { data: owner } = await supabase.from('owners').select('id, name').ilike('name', '%バカラ%').single();
  console.log("Owner:", owner);

  const { data: users } = await supabase.from('users').select('*').eq('owner_id', owner.id);
  console.log("Baccarat Users:", users);

  // パスワードをテスト用に一時設定してログイン試行できるようにするスクリプトを作成
}

getBaccaratUser();
