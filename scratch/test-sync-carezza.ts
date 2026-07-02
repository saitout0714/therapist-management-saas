import { syncScraperSite } from '../lib/sync/scraper';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log('Running dry-run sync for カレッツァ starting from', todayStr);
  
  await syncScraperSite(
    'カレッツァ',
    todayStr,
    2, // Sync today and tomorrow
    true, // dryRun = true
    true, // update = true
    true, // delShifts = true
    true, // force = true (override skip past/today checks to allow test)
    (msg) => process.stdout.write(msg)
  );
}

run();
