require('dotenv').config({ path: 'c:/Users/saitou-cyberpunk/Desktop/yoyakukanri/therapist-management-saas/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: shops, error: shopErr } = await supabase
    .from('shops')
    .select('id, name');
  if (shopErr) { console.error(shopErr); return; }

  const { data: rules, error: ruleErr } = await supabase
    .from('shop_back_rules')
    .select('shop_id, business_day_cutoff');
  if (ruleErr) { console.error(ruleErr); return; }

  const ruleMap = {};
  for (const r of rules || []) ruleMap[r.shop_id] = r.business_day_cutoff;

  for (const s of shops || []) {
    console.log(s.name, '->', ruleMap[s.id] ?? '(未設定 → デフォルト06:00:00)');
  }
}
run();
