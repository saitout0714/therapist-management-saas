import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prodUrl = process.env.PRODUCTION_DATABASE_URL;

async function run() {
  if (!prodUrl) {
    console.error('No prod database URL configured.');
    return;
  }
  const client = new Client({ connectionString: prodUrl });
  try {
    await client.connect();
    
    // Get shops mapping for display
    const { rows: shops } = await client.query('SELECT id, name FROM shops');
    const shopMap = new Map<string, string>();
    for (const shop of shops) {
      shopMap.set(shop.id, shop.name);
    }

    const names = ['いちか', 'もえか', 'みこと', 'みなみ'];
    for (const name of names) {
      console.log(`\n=================== Name: ${name} ===================`);
      const { rows: ths } = await client.query(
        `SELECT id, name, shop_id, is_active, created_at FROM therapists WHERE name = $1`,
        [name]
      );
      console.log(`Found ${ths.length} therapists:`);
      for (const therapist of ths) {
        const shopName = shopMap.get(therapist.shop_id) || therapist.shop_id;
        const { rows: shifts } = await client.query(
          `SELECT COUNT(*) FROM shifts WHERE therapist_id = $1`,
          [therapist.id]
        );
        console.log(`- Shop: ${shopName} (Shop ID: ${therapist.shop_id})`);
        console.log(`  Therapist ID: ${therapist.id}`);
        console.log(`  Active: ${therapist.is_active}`);
        console.log(`  Created At: ${therapist.created_at}`);
        console.log(`  Shifts Count in YOYAKL: ${shifts[0].count}`);
      }
    }
  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
