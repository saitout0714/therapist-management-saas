const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) {
    console.error("PRODUCTION_DATABASE_URL not found");
    return;
  }

  console.log("Connecting to PRODUCTION database...");
  const client = new Client({ connectionString: prodUrl });
  await client.connect();

  try {
    console.log("Applying add-default-back-amounts migration...");

    const sql = `
      ALTER TABLE shop_back_rules
        ADD COLUMN IF NOT EXISTS course_back_amount       INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS option_back_amount       INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS nomination_back_amount   INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_therapist_burden INTEGER NOT NULL DEFAULT 0;

      COMMENT ON COLUMN shop_back_rules.course_back_amount
        IS '店舗デフォルト：コース1件あたりのセラピストバック額（円）';
      COMMENT ON COLUMN shop_back_rules.option_back_amount
        IS '店舗デフォルト：オプション1件あたりのセラピストバック額（円）';
      COMMENT ON COLUMN shop_back_rules.nomination_back_amount
        IS '店舗デフォルト：指名料のセラピストバック額（円）';
      COMMENT ON COLUMN shop_back_rules.discount_therapist_burden
        IS '店舗デフォルト：割引発生時のセラピスト負担額（円）';
    `;

    await client.query(sql);
    console.log("Migration applied successfully!");

    // Verify columns
    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'shop_back_rules'
    `);
    console.log("\n=== VERIFIED COLUMNS ===");
    console.log(columnsRes.rows);

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
