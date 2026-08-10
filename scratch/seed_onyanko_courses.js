require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function seedOnyankoCourses() {
  const connectionString = process.env.PRODUCTION_DATABASE_URL;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("Connected to DB.");

    const shopId = '5e329003-d789-4d07-a837-b7da7c5e75fa'; // onyankospa

    // 1. Delete test courses for onyankospa
    console.log("Deleting old courses for onyankospa...");
    await client.query("DELETE FROM courses WHERE shop_id = $1;", [shopId]);

    // 2. Insert standard Onyanko Spa courses
    const coursesToInsert = [
      {
        shop_id: shopId,
        category_name: 'Standard Onyanko Aroma (スタンダードアロマ)',
        name: '70分 お試しニャンこコース',
        duration: 70,
        base_price: 13000,
        back_amount: 0,
        description: '初めてのお客様やサクッと癒やされたい方に',
        is_active: true,
        display_order: 1,
      },
      {
        shop_id: shopId,
        category_name: 'Standard Onyanko Aroma (スタンダードアロマ)',
        name: '90分 定番おニャンこ贅沢コース',
        duration: 90,
        base_price: 16000,
        back_amount: 0,
        description: '一番人気の定番！全身をじっくりほぐします',
        is_active: true,
        display_order: 2,
      },
      {
        shop_id: shopId,
        category_name: 'Standard Onyanko Aroma (スタンダードアロマ)',
        name: '120分 極上とろけるロングコース',
        duration: 120,
        base_price: 21000,
        back_amount: 0,
        description: '存分に密着と癒やしを満喫したい貴方に',
        is_active: true,
        display_order: 3,
      },
      {
        shop_id: shopId,
        category_name: 'Special Premium Option (オプション)',
        name: '密着ディープエステ',
        duration: 0,
        base_price: 3000,
        back_amount: 0,
        description: 'お好みのおもてなしを追加できます。',
        is_active: true,
        display_order: 4,
      },
      {
        shop_id: shopId,
        category_name: 'Special Premium Option (オプション)',
        name: '温感スパオイル変更',
        duration: 0,
        base_price: 2000,
        back_amount: 0,
        description: '',
        is_active: true,
        display_order: 5,
      },
    ];

    for (const c of coursesToInsert) {
      await client.query(`
        INSERT INTO courses (shop_id, category_name, name, duration, base_price, back_amount, description, is_active, display_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW());
      `, [c.shop_id, c.category_name, c.name, c.duration, c.base_price, c.back_amount, c.description, c.is_active, c.display_order]);
    }

    console.log("Successfully seeded 5 courses for onyankospa!");

    const res = await client.query("SELECT id, category_name, name, duration, base_price FROM courses WHERE shop_id = $1 ORDER BY display_order;", [shopId]);
    console.log("Current courses in DB:", res.rows);

  } catch (err) {
    console.error("Error seeding courses:", err);
  } finally {
    await client.end();
  }
}

seedOnyankoCourses();
