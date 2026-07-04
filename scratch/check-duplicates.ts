import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!dbUrl) {
    console.error('Production database URL not found in .env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('Connected to Production Database.');

    // 1. Fetch all shops
    const shopsRes = await client.query("SELECT id, name FROM shops WHERE is_active = true ORDER BY name");
    console.log(`Scanning duplicate therapists across all ${shopsRes.rows.length} active shops...\n`);

    // Helper to normalize name (remove all spaces and lowercase)
    const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '').replace(/　/g, '');

    let totalDuplicatesFound = 0;

    for (const shop of shopsRes.rows) {
      // Fetch all therapists for this shop
      const therapistsRes = await client.query(
        "SELECT id, name, is_active, created_at FROM therapists WHERE shop_id = $1 ORDER BY name",
        [shop.id]
      );

      const therapists = therapistsRes.rows;
      const grouped: Record<string, typeof therapists> = {};
      therapists.forEach((t) => {
        const norm = normalizeName(t.name);
        if (!grouped[norm]) grouped[norm] = [];
        grouped[norm].push(t);
      });

      let shopHasDuplicates = false;
      for (const [norm, list] of Object.entries(grouped)) {
        if (list.length > 1) {
          if (!shopHasDuplicates) {
            console.log(`[SHOP] ${shop.name} (ID: ${shop.id})`);
            shopHasDuplicates = true;
          }
          totalDuplicatesFound++;
          console.log(`  Duplicate found for "${norm}":`);
          list.forEach((t) => {
            console.log(`    - ID: ${t.id}, Name: "${t.name}", Active: ${t.is_active}, CreatedAt: ${t.created_at}`);
          });
        }
      }
      if (shopHasDuplicates) {
        console.log('');
      }
    }

    console.log(`Scan completed. Total duplicate groups found: ${totalDuplicatesFound}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
