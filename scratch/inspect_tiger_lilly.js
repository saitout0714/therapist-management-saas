const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase URL or Service Role Key is missing in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTigerLilly() {
  const shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c';

  console.log("=== SHOP DETAILS ===");
  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single();
  if (shopErr) {
    console.error("Error fetching shop:", shopErr);
  } else {
    console.log(shop);
  }

  console.log("\n=== SHOP BACK RULES ===");
  const { data: shopRules, error: ruleErr } = await supabase
    .from('shop_back_rules')
    .select('*')
    .eq('shop_id', shopId);
  if (ruleErr) {
    console.error("Error fetching shop back rules:", ruleErr);
  } else {
    console.log(shopRules);
  }

  console.log("\n=== OPTIONS ===");
  const { data: options, error: optErr } = await supabase
    .from('options')
    .select('*')
    .eq('shop_id', shopId);
  if (optErr) {
    console.error("Error fetching options:", optErr);
  } else {
    console.log(options);
  }

  console.log("\n=== OPTION BACK RULES ===");
  const { data: optionRules, error: optRuleErr } = await supabase
    .from('option_back_rules')
    .select('*')
    .eq('shop_id', shopId);
  if (optRuleErr) {
    console.error("Error fetching option back rules:", optRuleErr);
  } else {
    console.log(optionRules);
  }
}

inspectTigerLilly();
