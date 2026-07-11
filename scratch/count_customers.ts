import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(url, key)

async function run() {
  const { data: shops, error: shopError } = await supabase
    .from('shops')
    .select('id, name')

  if (shopError) {
    console.error('Error fetching shops:', shopError)
    return
  }

  console.log('Customer counts per shop:')
  for (const shop of shops) {
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shop.id)
    
    if (error) {
      console.error(`Error counting for ${shop.name}:`, error)
    } else {
      console.log(`- ${shop.name} (${shop.id}): ${count} customers`)
    }
  }
}

run()
