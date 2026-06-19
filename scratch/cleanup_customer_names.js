const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.PRODUCTION_DATABASE_URL;

if (!connectionString) {
  console.error("Missing PRODUCTION_DATABASE_URL in .env.local");
  process.exit(1);
}

function cleanName(name) {
  return name.replace(/^(新規|ご新規|会員|人気)\s*/, '').trim();
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    // トランザクション開始
    await client.query('BEGIN');
    
    console.log("Fetching all customers...");
    const { rows: allCustomers } = await client.query(
      `SELECT id, name, phone, email, memo, shop_id FROM public.customers`
    );
    console.log(`Loaded ${allCustomers.length} customers.`);

    // 「新規」などのプレフィックスを持つ顧客
    const prefixCustomers = allCustomers.filter(c => {
      const name = c.name || '';
      return name.startsWith('新規') || name.startsWith('ご新規') || name.startsWith('会員') || name.startsWith('人気');
    });

    console.log(`Found ${prefixCustomers.length} customers with prefixes.`);

    let renameCount = 0;
    let mergeCount = 0;

    for (const pCust of prefixCustomers) {
      const targetName = cleanName(pCust.name);
      
      // 同じ店舗内で、すでに「プレフィックスなし」の名前を持つ顧客が存在するか探す
      const match = allCustomers.find(c => c.shop_id === pCust.shop_id && c.name === targetName);

      if (match) {
        // 重複が存在する場合 -> 統合 (マージ) する
        console.log(`🔗 Merge: "${pCust.name}" (ID: ${pCust.id}) -> "${match.name}" (ID: ${match.id})`);
        
        // 1. reservations の customer_id を更新
        await client.query(
          `UPDATE public.reservations SET customer_id = $1 WHERE customer_id = $2`,
          [match.id, pCust.id]
        );

        // 2. customer_therapist_ng の customer_id を更新（すでに存在してユニーク制約に引っかかるものは競合回避して削除する）
        const { rows: existingNG } = await client.query(
          `SELECT therapist_id FROM public.customer_therapist_ng WHERE customer_id = $1`,
          [match.id]
        );
        const ngTherapistIds = new Set(existingNG.map(r => r.therapist_id));

        const { rows: prefixNG } = await client.query(
          `SELECT therapist_id FROM public.customer_therapist_ng WHERE customer_id = $1`,
          [pCust.id]
        );

        for (const ng of prefixNG) {
          if (!ngTherapistIds.has(ng.therapist_id)) {
            await client.query(
              `UPDATE public.customer_therapist_ng SET customer_id = $1 WHERE customer_id = $2 AND therapist_id = $3`,
              [match.id, pCust.id, ng.therapist_id]
            );
          }
        }
        // マージされずに残った重複NGは削除
        await client.query(
          `DELETE FROM public.customer_therapist_ng WHERE customer_id = $1`,
          [pCust.id]
        );

        // 3. phone, email, memo などの情報をマージする（プレフィックスなし側が空の場合に補完）
        const phoneUpdate = !match.phone && pCust.phone ? pCust.phone : null;
        const emailUpdate = !match.email && pCust.email ? pCust.email : null;
        const memoUpdate = !match.memo && pCust.memo ? pCust.memo : null;
        
        if (phoneUpdate || emailUpdate || memoUpdate) {
          await client.query(
            `UPDATE public.customers SET 
              phone = COALESCE(phone, $1),
              email = COALESCE(email, $2),
              memo = COALESCE(memo, $3)
             WHERE id = $4`,
            [phoneUpdate, emailUpdate, memoUpdate, match.id]
          );
        }

        // 4. 重複したプレフィックス側顧客の削除
        await client.query(`DELETE FROM public.customers WHERE id = $1`, [pCust.id]);
        
        mergeCount++;
      } else {
        // 重複が存在しない場合 -> 単に名前を変更する (リネーム)
        console.log(`✏️ Rename: "${pCust.name}" -> "${targetName}"`);
        await client.query(
          `UPDATE public.customers SET name = $1 WHERE id = $2`,
          [targetName, pCust.id]
        );
        
        // メモリ上での競合回避のために顧客オブジェクトの名前も更新しておく
        pCust.name = targetName;
        renameCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`\n🎉 Cleansing Completed successfully!`);
    console.log(`- Renamed (Prefix removed): ${renameCount} records`);
    console.log(`- Merged & Deleted duplicates: ${mergeCount} records`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Error occurred. Transaction rolled back.", err);
  } finally {
    await client.end();
  }
}

run();
