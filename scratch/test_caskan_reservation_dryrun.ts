import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { syncCaskanReservations } from '../lib/sync/caskan'

async function run() {
  await syncCaskanReservations('rabbit_tachikawa', '2026-07-21', '2026-08-10', true, (msg) => {
    process.stdout.write(msg)
  })
}

run().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
