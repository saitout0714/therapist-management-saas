import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { fetchTherapistsFromEstama } from '../lib/sync/estama';
dotenv.config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.PRODUCTION_DATABASE_URL;
  if (!connectionString) {
    console.error('No PRODUCTION_DATABASE_URL');
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const shopsRes = await client.query(`
      SELECT id, name, estama_login_id, estama_password, estama_shop_url
      FROM shops
      WHERE estama_login_id IS NOT NULL;
    `);

    const shops = shopsRes.rows;
    console.log('Shops with Estama credentials:', shops.map(s => s.name));

    for (const shop of shops) {
      console.log(`Processing shop: ${shop.name} (${shop.id})`);
      const shopUrl = shop.estama_shop_url || 'https://estama.jp/login/?r=/admin/';
      
      const portalTherapists = await fetchTherapistsFromEstama(
        shopUrl,
        shop.estama_login_id,
        shop.estama_password
      );

      console.log(`Fetched ${portalTherapists.length} therapists from Estama for ${shop.name}:`, portalTherapists.map(t => `${t.name} (${t.id})`));

      const localTherapistsRes = await client.query(`
        SELECT id, name, estama_therapist_id
        FROM therapists
        WHERE shop_id = $1;
      `, [shop.id]);

      const localTherapists = localTherapistsRes.rows;
      let matchedCount = 0;

      for (const portalT of portalTherapists) {
        const normalizedPortalName = portalT.name.replace(/\s+/g, '').toLowerCase();
        
        const matchedLocal = localTherapists.find(localT => {
          const normalizedLocalName = localT.name.replace(/\s+/g, '').toLowerCase();
          return normalizedLocalName === normalizedPortalName;
        });

        if (matchedLocal) {
          console.log(`Matching local "${matchedLocal.name}" (${matchedLocal.id}) -> Estama ID ${portalT.id}`);
          await client.query(`
            UPDATE therapists
            SET estama_therapist_id = $1
            WHERE id = $2;
          `, [portalT.id, matchedLocal.id]);
          matchedCount++;
        } else {
          console.log(`No local match for Estama therapist "${portalT.name}" (${portalT.id})`);
        }
      }

      console.log(`Matched and updated ${matchedCount} therapists for ${shop.name}!`);
    }
  } finally {
    await client.end();
  }
}

main();
