import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.PRODUCTION_DATABASE_URL;
  if (!connectionString) {
    console.error('No PRODUCTION_DATABASE_URL found');
    return;
  }

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    
    // Check if column exists
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='shops' AND column_name='needs_sync';
    `);
    
    if (checkRes.rowCount === 0) {
      console.log('Adding needs_sync column...');
      await client.query(`
        ALTER TABLE shops ADD COLUMN needs_sync BOOLEAN DEFAULT false;
      `);
      console.log('Successfully added needs_sync column.');
    } else {
      console.log('needs_sync column already exists.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main();
