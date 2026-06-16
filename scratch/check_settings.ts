import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(url, key)

async function run() {
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('*')

  if (error) {
    console.error('Error fetching settings:', error)
    return
  }

  console.log('system_settings entries:')
  settings.forEach(s => {
    console.log(`- Shop ID: ${s.shop_id}`)
    console.log(`  SMTP Host: ${s.smtp_host}`)
    console.log(`  SMTP Port: ${s.smtp_port}`)
    console.log(`  SMTP Secure: ${s.smtp_secure}`)
    console.log(`  SMTP User: ${s.smtp_user}`)
    console.log(`  SMTP Pass: ${s.smtp_pass ? '****' : 'null'}`)
    console.log(`  SMTP From: ${s.smtp_from}`)
  })
}

run()
