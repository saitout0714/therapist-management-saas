const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function migrate(dbUrl, label) {
  console.log(`Migrating ${label}...`);
  if (!dbUrl) {
    console.error(`Database URL for ${label} is missing!`);
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    
    // Add display_order to discount_policies
    await client.query(`
      ALTER TABLE discount_policies 
      ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0 NOT NULL
    `);
    console.log(`Added display_order to discount_policies in ${label}`);

    // Add display_order to deduction_rules
    await client.query(`
      ALTER TABLE deduction_rules 
      ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0 NOT NULL
    `);
    console.log(`Added display_order to deduction_rules in ${label}`);
  } catch (err) {
    console.error(`Error in ${label}:`, err.message);
  } finally {
    await client.end();
  }
}

async function run() {
  await migrate(process.env.DEVELOPMENT_DATABASE_URL, 'Development');
  await migrate(process.env.PRODUCTION_DATABASE_URL, 'Production');
}

run();
