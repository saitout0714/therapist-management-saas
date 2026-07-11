import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(url, key)

async function run() {
  const { data: therapists, error } = await supabase
    .from('therapists')
    .select('id, name, photo_url')
    .not('photo_url', 'is', null)
    .neq('photo_url', 'null')
    .neq('photo_url', '')
    .limit(10)

  if (error) {
    console.error('Error fetching therapists:', error)
    return
  }

  console.log(`Found ${therapists.length} therapists with actual photos.`)
  therapists.forEach(t => {
    console.log(`- ${t.name}: "${t.photo_url}"`)
  })
}

run()
