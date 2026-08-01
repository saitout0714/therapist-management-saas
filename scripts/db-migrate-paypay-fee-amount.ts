import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate(label: string, dbUrl: string | undefined) {
  if (!dbUrl) {
    console.log(`${label}: URL not found, skipping.`);
    return;
  }

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log(`${label}: Connected.`);

    // credit_fee_amount はクレジット手数料専用に戻し、PayPay手数料は別列で保持する。
    // 移行時点で paypay 予約は0件のため、既存 credit_fee_amount は全て純クレジット手数料。
    await client.query(`
      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS paypay_fee_amount INTEGER DEFAULT 0;
    `);

    console.log(`${label}: paypay_fee_amount column ensured.`);
  } catch (err) {
    console.error(`${label}: Error during migration:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

async function main() {
  await migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
}

main();
