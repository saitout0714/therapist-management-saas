import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fetchTherapistsFromEstama } from '../lib/sync/estama';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, estama_login_id, estama_password, estama_shop_url, hp_url')
    .not('estama_login_id', 'is', null);

  console.log('Shops with Estama credentials:', shops);

  for (const shop of shops || []) {
    console.log(`Processing shop: ${shop.name} (${shop.id})`);
    const shopUrl = shop.estama_shop_url || shop.hp_url || 'https://estama.jp/login/?r=/admin/';
    
    try {
      const portalTherapists = await fetchTherapistsFromEstama(
        shopUrl,
        shop.estama_login_id,
        shop.estama_password
      );

      console.log(`Fetched ${portalTherapists.length} therapists from Estama for ${shop.name}`);

      const { data: localTherapists } = await supabase
        .from('therapists')
        .select('id, name, estama_therapist_id')
        .eq('shop_id', shop.id);

      let matchedCount = 0;

      for (const portalT of portalTherapists) {
        const normalizedPortalName = portalT.name.replace(/\s+/g, '').toLowerCase();
        
        const matchedLocal = localTherapists?.find(localT => {
          const normalizedLocalName = localT.name.replace(/\s+/g, '').toLowerCase();
          return normalizedLocalName === normalizedPortalName;
        });

        if (matchedLocal) {
          console.log(`Matching local "${matchedLocal.name}" -> Estama ID ${portalT.id}`);
          await supabase
            .from('therapists')
            .update({ estama_therapist_id: portalT.id })
            .eq('id', matchedLocal.id);
          matchedCount++;
        } else {
          console.log(`No local match for Estama therapist "${portalT.name}" (${portalT.id})`);
        }
      }

      console.log(`Matched ${matchedCount} therapists for ${shop.name}!`);
    } catch (e) {
      console.error(`Failed to fetch/match for ${shop.name}:`, e);
    }
  }
}

main();
