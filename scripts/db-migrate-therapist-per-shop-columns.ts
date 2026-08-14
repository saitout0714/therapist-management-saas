/**
 * Phase 2 ステップ1：セラピストを「人」と「店舗ごとの見せ方」に分けるための列を用意する。
 *
 * 列を足すだけで、既存の画面の動きは何も変わらない。値はすべて null か既定値で入る。
 *
 * therapist_shops に持たせる項目は、店舗ごとに変わりうるものだけ。
 * null なら therapists 側の共通値を使う、という運用にする。
 * ランクは特に重要で、これを移さずに人を統合するとバック金額が変わる。
 *
 * 外部キーの追加時は「2つのテーブル間に経路が2本できないか」を必ず確認すること。
 * owners → shops を張ったときに shops に owners を埋め込むクエリが壊れ、
 * 管理画面が停止した事例がある（2026-08-11）。
 * 今回追加する参照はいずれも既存経路と重複しない。
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
    await client.query('BEGIN');

    // --- 人がどのグループに属するか ---
    await client.query(`
      ALTER TABLE therapists
        ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES owners(id);
    `);

    // --- 在籍と、店舗ごとの見せ方 ---
    await client.query(`
      ALTER TABLE therapist_shops
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS rank_id   uuid REFERENCES therapist_ranks(id),
        ADD COLUMN IF NOT EXISTS age       integer,
        ADD COLUMN IF NOT EXISTS height    integer,
        ADD COLUMN IF NOT EXISTS bust      integer,
        ADD COLUMN IF NOT EXISTS bust_cup  text,
        ADD COLUMN IF NOT EXISTS waist     integer,
        ADD COLUMN IF NOT EXISTS hip       integer,
        ADD COLUMN IF NOT EXISTS comment   text,
        ADD COLUMN IF NOT EXISTS x_url     text;
    `);

    // --- 写真を店舗ごとに ---
    await client.query(`
      ALTER TABLE therapist_photos
        ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES shops(id);
    `);

    console.log(`${label}: 列を用意しました`);

    // --- therapists.owner_id を主所属店舗から埋める ---
    const filled = await client.query(`
      UPDATE therapists t
         SET owner_id = s.owner_id
        FROM shops s
       WHERE s.id = t.shop_id
         AND s.owner_id IS NOT NULL
         AND t.owner_id IS DISTINCT FROM s.owner_id
      RETURNING t.id;
    `);
    console.log(`${label}: owner_id を設定 = ${filled.rowCount}名`);

    await client.query('COMMIT');

    // --- 確認 ---
    const check = await client.query(`
      SELECT count(*)::int AS total,
             count(owner_id)::int AS with_owner
        FROM therapists;
    `);
    console.log(`\n${label}: セラピスト ${check.rows[0].total}名 / owner_id あり ${check.rows[0].with_owner}名`);

    const noOwner = await client.query(`
      SELECT s.name, count(*)::int AS n
        FROM therapists t JOIN shops s ON s.id = t.shop_id
       WHERE t.owner_id IS NULL
       GROUP BY s.name;
    `);
    if (noOwner.rows.length > 0) {
      console.log(`${label}: owner_id が付かなかった内訳`);
      noOwner.rows.forEach((r: any) => console.log(`   ${r.name}: ${r.n}名`));
    } else {
      console.log(`${label}: 全員に owner_id が付きました`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${label}: Error:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
