/**
 * 料金・バックの共有設定を「店舗が店舗を指す」方式から「オーナー単位の設定」へ移す。
 *
 * これまでは shops.pricing_source_shop_id / back_source_shop_id に各店舗が基準店を指させていた。
 * その方式だと店舗が増えるたびに新店側で指し直す操作が要るため、設定をオーナー側に1つ持たせる。
 *
 * 既存の shops.*_source_shop_id は消さずに残す。参照が完全に消えてから別途削除する。
 * 参照先が同一オーナー内で割れている場合は移行対象から外す（HAVING COUNT(DISTINCT ...) = 1）。
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate(label: string, dbUrl: string | undefined) {
  if (!dbUrl) {
    console.log(`${label}: URL not found, skipping.`);
    return;
  }

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log(`${label}: Connected.`);
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE owners
        ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'independent',
        ADD COLUMN IF NOT EXISTS pricing_base_shop_id uuid REFERENCES shops(id),
        ADD COLUMN IF NOT EXISTS back_mode text NOT NULL DEFAULT 'independent',
        ADD COLUMN IF NOT EXISTS back_base_shop_id uuid REFERENCES shops(id);
    `);
    console.log(`${label}: columns ensured.`);

    // 値を 'shared' / 'independent' に限定する。共有なら基準店が必須。
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'owners_pricing_mode_check') THEN
          ALTER TABLE owners ADD CONSTRAINT owners_pricing_mode_check
            CHECK (pricing_mode IN ('shared','independent')
                   AND (pricing_mode <> 'shared' OR pricing_base_shop_id IS NOT NULL));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'owners_back_mode_check') THEN
          ALTER TABLE owners ADD CONSTRAINT owners_back_mode_check
            CHECK (back_mode IN ('shared','independent')
                   AND (back_mode <> 'shared' OR back_base_shop_id IS NOT NULL));
        END IF;
      END $$;
    `);
    console.log(`${label}: check constraints ensured.`);

    const pricing = await client.query(`
      UPDATE owners o
         SET pricing_mode = 'shared',
             pricing_base_shop_id = sub.base
        FROM (
          SELECT s.owner_id, MIN(s.pricing_source_shop_id::text)::uuid AS base
            FROM shops s
           WHERE s.pricing_source_shop_id IS NOT NULL
             AND s.owner_id IS NOT NULL
           GROUP BY s.owner_id
          HAVING COUNT(DISTINCT s.pricing_source_shop_id) = 1
        ) sub
       WHERE o.id = sub.owner_id
      RETURNING o.name;
    `);
    console.log(`${label}: pricing 共有に設定したオーナー = ${pricing.rowCount} 件 ${pricing.rows.map(r => r.name).join(', ')}`);

    const back = await client.query(`
      UPDATE owners o
         SET back_mode = 'shared',
             back_base_shop_id = sub.base
        FROM (
          SELECT s.owner_id, MIN(s.back_source_shop_id::text)::uuid AS base
            FROM shops s
           WHERE s.back_source_shop_id IS NOT NULL
             AND s.owner_id IS NOT NULL
           GROUP BY s.owner_id
          HAVING COUNT(DISTINCT s.back_source_shop_id) = 1
        ) sub
       WHERE o.id = sub.owner_id
      RETURNING o.name;
    `);
    console.log(`${label}: back 共有に設定したオーナー = ${back.rowCount} 件 ${back.rows.map(r => r.name).join(', ')}`);

    await client.query('COMMIT');
    console.log(`${label}: committed.`);

    const check = await client.query(`
      SELECT o.name,
             o.pricing_mode, ps.name AS pricing_base,
             o.back_mode,    bs.name AS back_base
        FROM owners o
        LEFT JOIN shops ps ON ps.id = o.pricing_base_shop_id
        LEFT JOIN shops bs ON bs.id = o.back_base_shop_id
       WHERE o.pricing_mode = 'shared' OR o.back_mode = 'shared'
       ORDER BY o.name;
    `);
    console.log(`\n${label}: 共有設定になったオーナー`);
    check.rows.forEach(r =>
      console.log(`   ${r.name}  料金=${r.pricing_mode}${r.pricing_base ? '→' + r.pricing_base : ''}  バック=${r.back_mode}${r.back_base ? '→' + r.back_base : ''}`)
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${label}: Error during migration:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

async function main() {
  await migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
}

main();
