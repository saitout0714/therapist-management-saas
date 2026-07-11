const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = process.env.PRODUCTION_DATABASE_URL;

if (!connectionString) {
  console.error('Error: PRODUCTION_DATABASE_URL is not set in env.');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Connecting to production database...');
  await client.connect();
  try {
    console.log('Running migration: adding customer_notified and therapist_notified to public.reservations...');
    await client.query(`
      ALTER TABLE public.reservations
      ADD COLUMN IF NOT EXISTS customer_notified BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS therapist_notified BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('Migration completed successfully!');

    // Let's verify the columns were created
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reservations'
        AND column_name IN ('customer_notified', 'therapist_notified')
      ORDER BY column_name;
    `);
    console.log('Verification:');
    res.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
