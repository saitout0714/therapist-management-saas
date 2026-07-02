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
    
    // Add customer_template to system_settings
    await client.query(`
      ALTER TABLE system_settings 
      ADD COLUMN IF NOT EXISTS customer_template TEXT
    `);
    console.log(`Added customer_template to system_settings in ${label}`);
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
