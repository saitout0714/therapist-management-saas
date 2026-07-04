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

    // 1. Fetch all active shops
    const shopsRes = await client.query("SELECT id, name FROM shops WHERE is_active = true ORDER BY name");
    console.log(`Scanning and merging duplicates across all ${shopsRes.rows.length} active shops...\n`);

    const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '').replace(/　/g, '');

    await client.query('BEGIN'); // Start transaction for safety

    let totalMergedGroups = 0;

    for (const shop of shopsRes.rows) {
      // Fetch all therapists for this shop
      const therapistsRes = await client.query(
        "SELECT id, name, created_at FROM therapists WHERE shop_id = $1 ORDER BY name",
        [shop.id]
      );

      const therapists = therapistsRes.rows;
      const grouped: Record<string, typeof therapists> = {};
      therapists.forEach((t) => {
        const norm = normalizeName(t.name);
        if (!grouped[norm]) grouped[norm] = [];
        grouped[norm].push(t);
      });

      for (const [norm, list] of Object.entries(grouped)) {
        if (list.length > 1) {
          totalMergedGroups++;
          // Sort by created_at ascending (keep the oldest as primary)
          list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const primary = list[0];
          
          console.log(`[SHOP] ${shop.name}: Merging duplicates for "${norm}":`);
          console.log(`  Keeping Primary: ID = ${primary.id}, Name = "${primary.name}"`);

          for (let i = 1; i < list.length; i++) {
            const duplicate = list[i];
            console.log(`  Processing Duplicate: ID = ${duplicate.id}, Name = "${duplicate.name}"`);

            // Update reservations
            const resUpdate = await client.query(
              "UPDATE reservations SET therapist_id = $1 WHERE therapist_id = $2",
              [primary.id, duplicate.id]
            );
            console.log(`    - Moved ${resUpdate.rowCount} reservations`);

            // Update shifts
            const duplicateShifts = await client.query(
              "SELECT id, date FROM shifts WHERE therapist_id = $1",
              [duplicate.id]
            );

            for (const shift of duplicateShifts.rows) {
              const primaryShiftCheck = await client.query(
                "SELECT id FROM shifts WHERE therapist_id = $1 AND date = $2",
                [primary.id, shift.date]
              );

              if (primaryShiftCheck.rows.length > 0) {
                await client.query("DELETE FROM shifts WHERE id = $1", [shift.id]);
                console.log(`    - Deleted redundant shift on ${shift.date.toISOString().split('T')[0]}`);
              } else {
                await client.query(
                  "UPDATE shifts SET therapist_id = $1 WHERE id = $2",
                  [primary.id, shift.id]
                );
                console.log(`    - Moved shift on ${shift.date.toISOString().split('T')[0]}`);
              }
            }

            // Update therapist_photos
            const hasPhotoPrimary = await client.query("SELECT 1 FROM therapist_photos WHERE therapist_id = $1", [primary.id]);
            if (hasPhotoPrimary.rows.length > 0) {
              await client.query("DELETE FROM therapist_photos WHERE therapist_id = $1", [duplicate.id]);
              console.log(`    - Deleted duplicate photos`);
            } else {
              await client.query("UPDATE therapist_photos SET therapist_id = $1 WHERE therapist_id = $2", [primary.id, duplicate.id]);
              console.log(`    - Moved photos to primary`);
            }

            // Update therapist_pricing
            const hasPricingPrimary = await client.query("SELECT 1 FROM therapist_pricing WHERE therapist_id = $1", [primary.id]);
            if (hasPricingPrimary.rows.length > 0) {
              await client.query("DELETE FROM therapist_pricing WHERE therapist_id = $1", [duplicate.id]);
              console.log(`    - Deleted duplicate pricing`);
            } else {
              await client.query("UPDATE therapist_pricing SET therapist_id = $1 WHERE therapist_id = $2", [primary.id, duplicate.id]);
              console.log(`    - Moved pricing to primary`);
            }

            // Delete duplicate therapist
            await client.query("DELETE FROM therapists WHERE id = $1", [duplicate.id]);
            console.log(`    - Deleted duplicate therapist record: "${duplicate.name}"`);
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log(`\nAll duplicates across all shops merged and cleaned up successfully! Total groups merged: ${totalMergedGroups}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during merging, transaction rolled back:', err);
  } finally {
    await client.end();
  }
}

main();
