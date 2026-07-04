import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

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

    const sqlPath = path.join(__dirname, '../supabase/add-therapist-ng-courses.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration...');
    await client.query(sql);

    console.log('Database migration completed successfully!');
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
