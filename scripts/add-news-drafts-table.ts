import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prodUrl = process.env.PRODUCTION_DATABASE_URL;

async function run() {
  const query = fs.readFileSync(path.resolve(process.cwd(), 'supabase/add-news-drafts.sql'), 'utf-8');

  if (!prodUrl) {
    console.log('No prod db url found.');
    return;
  }

  console.log('Connecting to prod db...');
  const client = new Client({ connectionString: prodUrl });
  await client.connect();
  await client.query(query);
  console.log('Prod DB: news_drafts table created successfully.');
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
