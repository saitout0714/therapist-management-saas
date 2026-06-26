import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.PRODUCTION_DATABASE_URL;

async function run() {
  if (!dbUrl) {
    console.error('No database URL configured.');
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    
    console.log('\n--- Checking column data types in shifts table ---');
    const { rows: columns } = await client.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'shifts'`
    );
    console.log(columns);

  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
