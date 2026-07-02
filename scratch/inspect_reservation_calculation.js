const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) return;

  const client = new Client({ connectionString: prodUrl });
  await client.connect();

  try {
    const resId = '91f83c06-f24e-4989-bcfd-5207d6eac63d';
    
    // 予約
    const { rows: [res] } = await client.query('SELECT * FROM reservations WHERE id = $1', [resId]);
    console.log("=== RESERVATION ===");
    console.log(res);

    // セラピスト
    const { rows: [therapist] } = await client.query('SELECT * FROM therapists WHERE id = $1', [res.therapist_id]);
    console.log("\n=== THERAPIST ===");
    console.log(therapist);

    // コース
    const { rows: [course] } = await client.query('SELECT * FROM courses WHERE id = $1', [res.course_id]);
    console.log("\n=== COURSE ===");
    console.log(course);

    // 指名種別
    const { rows: [designation] } = await client.query('SELECT * FROM designation_types WHERE id = $1', [res.designation_type]);
    console.log("\n=== DESIGNATION TYPE ===");
    console.log(designation);

    // コースバックマトリクス (course_back_amounts)
    const { rows: matrix } = await client.query(`
      SELECT * FROM course_back_amounts 
      WHERE shop_id = $1 AND course_id = $2 AND rank_id = $3
    `, [res.shop_id, res.course_id, therapist.rank_id]);
    console.log("\n=== COURSE BACK MATRIX ===");
    console.log(matrix);

    // セラピスト個別オーバーライド
    const { rows: override } = await client.query(`
      SELECT * FROM therapist_back_overrides
      WHERE therapist_id = $1
    `, [res.therapist_id]);
    console.log("\n=== THERAPIST OVERRIDES ===");
    console.log(override);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
