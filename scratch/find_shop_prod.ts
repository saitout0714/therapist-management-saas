import { supabaseAdmin } from '../lib/supabaseAdmin'

async function findProdShop() {
  const { data: shops, error } = await supabaseAdmin
    .from('shops')
    .select('id, name, short_name');
  
  if (error) {
    console.error("Error fetching production shops:", error);
    return;
  }
  
  console.log("=== PRODUCTION SHOP LIST ===");
  shops.forEach(s => {
    console.log(`ID: ${s.id} | Name: ${s.name} | ShortName: ${s.short_name}`);
  });
}

findProdShop();
