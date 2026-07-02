import { supabaseAdmin } from '../lib/supabaseAdmin'

async function queryCourses() {
  const shopIds = [
    '4808aee9-9940-410c-aa5b-dd1364e2da2c', // タイガーリリー
    '36949671-c90c-4cf9-9d88-51bd71a2b352', // レジェンド
    'a628f5ad-3bda-442f-9cfe-c5c00c3e65c1'  // レジェンド目白
  ];

  const { data: courses, error } = await supabaseAdmin
    .from('courses')
    .select('id, name, duration, shop_id')
    .in('shop_id', shopIds);

  if (error) {
    console.error("Error query courses:", error);
    return;
  }

  console.log("=== COURSES ===");
  courses?.forEach(c => {
    console.log(`ID: ${c.id} | Name: ${c.name} | Time: ${c.duration} min | ShopID: ${c.shop_id}`);
  });
}

queryCourses();
