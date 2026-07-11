const { Client } = require('pg');

const shopId = '960d84c5-d1cd-44bc-a39a-85f8ecc3d51a'; // クイーンテラス

const urls = [
  "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres", // 本番
  "postgresql://postgres:al2021al0518@db.gzxzrohagleofxjntmpl.supabase.co:6543/postgres"  // 開発
];

async function deleteFromDb(connectionString) {
  console.log(`Connecting to database...`);
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    // 1. 予約の削除
    const resSelectQuery = `
      SELECT id, date, start_time, notes, created_at 
      FROM reservations 
      WHERE shop_id = $1 AND source = 'staff' AND created_at >= NOW() - INTERVAL '4 hours'
    `;
    const resResult = await client.query(resSelectQuery, [shopId]);
    console.log(`[DB] 該当する予約件数: ${resResult.rows.length} 件`);

    if (resResult.rows.length > 0) {
      const delResQuery = `
        DELETE FROM reservations 
        WHERE shop_id = $1 AND source = 'staff' AND created_at >= NOW() - INTERVAL '4 hours'
      `;
      const delResResult = await client.query(delResQuery, [shopId]);
      console.log(`[DB] 予約データを削除しました。削除件数: ${delResResult.rowCount} 件`);
    }

    // 2. 出勤の削除
    const shiftSelectQuery = `
      SELECT id, date, start_time, created_at 
      FROM shifts 
      WHERE shop_id = $1 AND created_at >= NOW() - INTERVAL '4 hours'
    `;
    const shiftResult = await client.query(shiftSelectQuery, [shopId]);
    console.log(`[DB] 該当する出勤件数: ${shiftResult.rows.length} 件`);

    if (shiftResult.rows.length > 0) {
      const delShiftQuery = `
        DELETE FROM shifts 
        WHERE shop_id = $1 AND created_at >= NOW() - INTERVAL '4 hours'
      `;
      const delShiftResult = await client.query(delShiftQuery, [shopId]);
      console.log(`[DB] 出勤データを削除しました。削除件数: ${delShiftResult.rowCount} 件`);
    }
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

async function run() {
  for (const url of urls) {
    console.log(`\n========================================`);
    console.log(`Target DB: ${url.split('@')[1]}`);
    await deleteFromDb(url);
  }
  console.log(`\n========================================`);
  console.log(`削除処理完了`);
}

run();
