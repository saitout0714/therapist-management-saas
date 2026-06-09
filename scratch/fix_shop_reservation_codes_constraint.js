const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function runMigrationForDb(name, connectionString) {
  console.log(`\n=== Running for ${name} ===`);
  if (!connectionString) {
    console.error(`Error: Connection string for ${name} is not set.`);
    return;
  }

  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    // Check if there are any duplicate shop_ids in the table
    const duplicates = await client.query(`
      SELECT shop_id, COUNT(*)
      FROM public.shop_reservation_codes
      GROUP BY shop_id
      HAVING COUNT(*) > 1;
    `);

    if (duplicates.rows.length > 0) {
      console.log(`Found duplicate shop_ids in ${name}:`, duplicates.rows);
      console.log('Resolving duplicates by keeping only the latest one...');
      for (const row of duplicates.rows) {
        await client.query(`
          DELETE FROM public.shop_reservation_codes
          WHERE shop_id = $1 AND id NOT IN (
            SELECT id FROM public.shop_reservation_codes
            WHERE shop_id = $1
            ORDER BY created_at DESC
            LIMIT 1
          );
        `, [row.shop_id]);
      }
    }

    console.log('Adding UNIQUE constraint on shop_id to shop_reservation_codes...');
    // We check if the unique constraint already exists, if not we add it
    await client.query(`
      ALTER TABLE public.shop_reservation_codes
      DROP CONSTRAINT IF EXISTS shop_reservation_codes_shop_id_key;
    `);
    await client.query(`
      ALTER TABLE public.shop_reservation_codes
      ADD CONSTRAINT shop_reservation_codes_shop_id_key UNIQUE (shop_id);
    `);
    console.log(`Constraint added successfully on ${name}!`);
  } catch (err) {
    console.error(`Failed on ${name}:`, err);
  } finally {
    await client.end();
  }
}

async function run() {
  await runMigrationForDb('Development Database', process.env.DEVELOPMENT_DATABASE_URL);
  await runMigrationForDb('Production Database', process.env.PRODUCTION_DATABASE_URL);
}

run();
