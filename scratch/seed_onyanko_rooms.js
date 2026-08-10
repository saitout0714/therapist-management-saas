require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function seedOnyankoRooms() {
  const connectionString = process.env.PRODUCTION_DATABASE_URL;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("Connected to DB.");

    const shopId = '5e329003-d789-4d07-a837-b7da7c5e75fa'; // onyankospa

    console.log("Deleting old rooms for onyankospa...");
    await client.query("DELETE FROM rooms WHERE shop_id = $1;", [shopId]);

    const roomsToInsert = [
      {
        shop_id: shopId,
        name: '歌舞伎町本店ルーム',
        display_name: '歌舞伎町メインルーム',
        address: '東京都新宿区歌舞伎町1丁目',
        google_map_url: 'https://maps.google.com/?q=東京都新宿区歌舞伎町1丁目',
        memo: '新宿駅東口徒歩3分。TOHOシネマズ徒歩1分。完全個室アロマエステ空間です。',
        order: 1,
        type: 'room',
      },
      {
        shop_id: shopId,
        name: '渋谷道玄坂ルーム',
        display_name: '道玄坂個室ルーム',
        address: '東京都渋谷区道玄坂2丁目',
        google_map_url: 'https://maps.google.com/?q=東京都渋谷区道玄坂2丁目',
        memo: '渋谷駅ハチ公口徒歩4分。道玄坂通近くの静かなラグジュアリールームです。',
        order: 2,
        type: 'room',
      },
    ];

    for (const r of roomsToInsert) {
      await client.query(`
        INSERT INTO rooms (shop_id, name, display_name, address, google_map_url, memo, "order", type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
      `, [r.shop_id, r.name, r.display_name, r.address, r.google_map_url, r.memo, r.order, r.type]);
    }

    console.log("Successfully seeded 2 rooms for onyankospa!");

  } catch (err) {
    console.error("Error seeding rooms:", err);
  } finally {
    await client.end();
  }
}

seedOnyankoRooms();
