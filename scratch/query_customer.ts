import { supabaseAdmin } from '../lib/supabaseAdmin'

async function queryCust() {
  const { data: c1, error: err1 } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, email, shop_id')
    .or('phone.eq.08012573431,phone.eq.08095422829');

  if (err1) {
    console.error("Error query customers:", err1);
    return;
  }

  console.log("=== CUSTOMERS ===");
  c1?.forEach(c => {
    console.log(`ID: ${c.id} | Name: ${c.name} | Phone: ${c.phone} | Email: ${c.email} | ShopID: ${c.shop_id}`);
  });
}

queryCust();
