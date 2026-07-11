import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prodUrl = process.env.PRODUCTION_DATABASE_URL;
const devUrl = process.env.DEVELOPMENT_DATABASE_URL;

async function runMigration(url: string | undefined, name: string) {
  if (!url) {
    console.log(`⚠️ ${name} is not configured.`);
    return;
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log(`🔌 Connected to ${name} database.`);
    
    console.log('Creating custom_templates table and setting RLS...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."custom_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "shop_id" uuid NOT NULL,
        "title" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now(),
        CONSTRAINT "custom_templates_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "custom_templates_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE
      );
    `);

    await client.query(`
      ALTER TABLE "public"."custom_templates" ENABLE ROW LEVEL SECURITY;
    `);

    await client.query(`
      DROP POLICY IF EXISTS "Custom Templates Shop Owner Policy" ON "public"."custom_templates";
    `);

    await client.query(`
      CREATE POLICY "Custom Templates Shop Owner Policy" ON "public"."custom_templates" 
        FOR ALL TO public USING (check_shop_access(shop_id));
    `);

    console.log(`✅ Migration completed successfully on ${name}!`);
  } catch (err: any) {
    console.error(`❌ ${name} migration error:`, err.message);
  } finally {
    await client.end();
  }
}

async function run() {
  await runMigration(devUrl, 'Development');
  await runMigration(prodUrl, 'Production');
}

run();
