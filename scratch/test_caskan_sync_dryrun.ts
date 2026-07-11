import { syncCaskanShop } from '../lib/sync/caskan'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function run() {
  console.log('🔄 Starting REAL sync for rabbit_tachikawa starting 2026-06-26...')
  
  const shopName = 'rabbit_tachikawa'
  const startDateStr = '2026-06-26'
  const weeks = 1
  const force = true // Force to include today
  const dryRun = false // Real sync, write to database
  
  await syncCaskanShop(shopName, startDateStr, weeks, force, dryRun, (msg) => {
    process.stdout.write(msg)
  })
  
  console.log('\n🔄 Real sync completed.')
}

run().catch(console.error)
