import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing local env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function insertLocalCourses() {
  const shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c'; // タイガーリリー
  
  const coursesToInsert = [
    { name: '60分', duration: 70, base_price: 10000, shop_id: shopId },
    { name: '90分', duration: 100, base_price: 15000, shop_id: shopId },
    { name: '120分', duration: 130, base_price: 23000, shop_id: shopId }
  ];

  const { data, error } = await supabase
    .from('courses')
    .insert(coursesToInsert)
    .select('id, name');

  if (error) {
    console.error("Error inserting local courses:", error);
    return;
  }

  console.log("Successfully inserted local courses:", data);
}

insertLocalCourses();
