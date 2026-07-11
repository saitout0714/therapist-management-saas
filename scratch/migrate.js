const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const sql = `
    ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS therapist_line_mode text NOT NULL DEFAULT 'official_line';
    COMMENT ON COLUMN public.shops.therapist_line_mode IS 'セラピスト連絡用LINEモード (official_line: 公式LINE, line: 普通のLINE)';
  `;

  const dbs = [
    { name: 'DEVELOPMENT', url: process.env.DEVELOPMENT_DATABASE_URL },
    { name: 'PRODUCTION', url: process.env.PRODUCTION_DATABASE_URL }
  ];

  for (const db of dbs) {
    if (!db.url) {
      console.log(`No URL found for ${db.name} database. Skipping.`);
      continue;
    }
    console.log(`Connecting to ${db.name} database...`);
    const client = new Client({
      connectionString: db.url,
      ssl: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      console.log(`Connected to ${db.name}. Executing migration...`);
      await client.query(sql);
      console.log(`Migration successful on ${db.name} database!`);
    } catch (err) {
      console.error(`Migration failed on ${db.name} database:`, err.message);
    } finally {
      await client.end();
    }
  }
}

run().catch(console.error);
