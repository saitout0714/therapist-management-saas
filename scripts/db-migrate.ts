import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const dbUrl = process.env.DEVELOPMENT_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
  if (!dbUrl) {
    console.error('Database URL not found in .env.local');
    process.exit(1);
  }

  console.log('Target database URL:', dbUrl);

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('Connected to Database successfully.');

    console.log('Dropping existing reception_source constraint...');
    await client.query(`
      ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_reception_source_check;
    `);

    console.log('Adding updated reception_source constraint including "owner"...');
    await client.query(`
      ALTER TABLE reservations ADD CONSTRAINT reservations_reception_source_check 
      CHECK (reception_source IN ('staff', 'client', 'therapist', 'owner'));
    `);

    console.log('Database migration completed successfully!');
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
