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

async function queryLocalCourses() {
  const shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c'; // タイガーリリー

  const { data: courses, error } = await supabase
    .from('courses')
    .select('id, name, duration, shop_id')
    .eq('shop_id', shopId);

  if (error) {
    console.error("Error query local courses:", error);
    return;
  }

  console.log("=== LOCAL COURSES ===");
  if (courses && courses.length > 0) {
    courses.forEach(c => {
      console.log(`ID: ${c.id} | Name: ${c.name} | Time: ${c.duration} min | ShopID: ${c.shop_id}`);
    });
  } else {
    console.log("No courses found for Tiger Lilly in local DB");
  }
}

queryLocalCourses();
