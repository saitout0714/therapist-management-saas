import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DRY_RUN = process.env.DRY_RUN !== 'false';
const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DEVELOPMENT_DATABASE_URL;
const tsujidoShopId = '92c51e51-339b-48ce-8535-0f45c859b195'; // 辻堂茅ヶ崎

if (!dbUrl) {
  console.error('❌ Database URL is not set.');
  process.exit(1);
}

const logPath = 'C:\\Users\\saitou-cyberpunk\\.gemini\\antigravity\\brain\\25e36bdc-d0ea-4712-84f8-bb69a5457d78\\.system_generated\\tasks\\task-135.log';

interface MergePair {
  sName: string;
  sId: string;
  normalName: string;
  normalId: string;
}

interface RenameRecord {
  oldName: string;
  newName: string;
}

interface PhoneUpdate {
  name: string;
  phone: string;
  originalPhone: string | null;
}

function parseLog(): { merges: MergePair[], renames: RenameRecord[], phones: PhoneUpdate[] } {
  console.log(`📖 Parsing log file: ${logPath}`);
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split('\n');

  const merges: MergePair[] = [];
  const renames: RenameRecord[] = [];
  const phones: PhoneUpdate[] = [];

  for (const line of lines) {
    // 1. マージログの検出
    const mergeMatch = line.match(/🔗 Duplicate found: "([^"]+)" \(ID: ([^)]+)\) -> "([^"]+)" \(ID: ([^)]+)\)/);
    if (mergeMatch) {
      merges.push({
        sName: mergeMatch[1],
        sId: mergeMatch[2],
        normalName: mergeMatch[3],
        normalId: mergeMatch[4]
      });
      continue;
    }

    // 2. リネームログの検出
    const renameMatch = line.match(/✏️ Rename needed \(no duplicate\): "([^"]+)" -> "([^"]+)"/);
    if (renameMatch) {
      renames.push({
        oldName: renameMatch[1],
        newName: renameMatch[2]
      });
      continue;
    }

    // 3. 電話番号更新（新規登録）の検出
    const phoneNewMatch = line.match(/📞 Match found! Naming: "([^"]+)" \(DB\) <= "([^"]+)" \(vCard: ([^)]+)\)/);
    if (phoneNewMatch) {
      phones.push({
        name: phoneNewMatch[1],
        phone: phoneNewMatch[3],
        originalPhone: null
      });
      continue;
    }

    // 4. 電話番号更新（上書き）の検出
    const phoneMismatchMatch = line.match(/⚠️ Phone mismatch for "([^"]+)": DB="([^"]+)" vs vCard="([^"]+)"/);
    if (phoneMismatchMatch) {
      phones.push({
        name: phoneMismatchMatch[1],
        phone: phoneMismatchMatch[3],
        originalPhone: phoneMismatchMatch[2]
      });
      continue;
    }
  }

  return { merges, renames, phones };
}

async function runRestore() {
  console.log(`♻️ Tsujido Shop Data Restore Script`);
  console.log(`MODE: ${DRY_RUN ? '🔍 DRY RUN (No database updates)' : '💾 LIVE RUN (Database will be updated)'}`);

  const { merges, renames, phones } = parseLog();
  console.log(`Parsed Merges to restore: ${merges.length}`);
  console.log(`Parsed Renames to restore: ${renames.length}`);
  console.log(`Parsed Phone updates to restore: ${phones.length}`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    if (!DRY_RUN) await client.query('BEGIN');

    // 1. 電話番号の復元（元に戻す）
    console.log('\n--- Step 1: Restoring phone numbers ---');
    let phoneRestoreCount = 0;
    for (const p of phones) {
      // ログに記録されている名前で顧客を検索
      // 注: リネームされた名前がクレンジングされてしまっているかもしれないので、
      // 復旧の順番としては、電話番号を戻す ➔ 名前にsを戻す の順で行うのが最も安全
      const { rows: custs } = await client.query(
        `SELECT id, name, phone FROM public.customers WHERE shop_id = $1 AND name = $2`,
        [tsujidoShopId, p.name]
      );

      if (custs.length === 1) {
        const cust = custs[0];
        console.log(`📞 Restoring phone for "${cust.name}": "${cust.phone}" -> "${p.originalPhone}"`);
        if (!DRY_RUN) {
          await client.query(
            `UPDATE public.customers SET phone = $1 WHERE id = $2`,
            [p.originalPhone, cust.id]
          );
        }
        phoneRestoreCount++;
      } else if (custs.length > 1) {
        console.log(`⚠️ Multiple candidates found for phone restore name "${p.name}". Skipping.`);
      } else {
        console.log(`❌ Customer not found for phone restore name "${p.name}".`);
      }
    }
    console.log(`Phone Restore: ${phoneRestoreCount} records processed.`);

    // 2. 名前のリネームを元に戻す（先頭のsを復元）
    console.log('\n--- Step 2: Restoring s-prefix customer names ---');
    let nameRestoreCount = 0;
    for (const r of renames) {
      // 表記統一された名前で検索
      const { rows: custs } = await client.query(
        `SELECT id, name FROM public.customers WHERE shop_id = $1 AND name = $2`,
        [tsujidoShopId, r.newName]
      );

      if (custs.length === 1) {
        const cust = custs[0];
        console.log(`✏️ Restoring name: "${cust.name}" -> "${r.oldName}"`);
        if (!DRY_RUN) {
          await client.query(
            `UPDATE public.customers SET name = $1 WHERE id = $2`,
            [r.oldName, cust.id]
          );
        }
        nameRestoreCount++;
      } else {
        console.log(`❌ Customer not found to restore name for: "${r.newName}"`);
      }
    }
    console.log(`Name Restore: ${nameRestoreCount} records processed.`);

    // 3. 重複マージされたペアの復元
    console.log('\n--- Step 3: Restoring merged duplicates ---');
    let mergeRestoreCount = 0;
    for (const m of merges) {
      console.log(`\n🔗 Restoring duplicate pair: "${m.sName}" (ID: ${m.sId}) <= "${m.normalName}" (ID: ${m.normalId})`);

      if (!DRY_RUN) {
        // A. 削除された s付き顧客レコードを再作成する
        // 元の情報は基本的に name と shop_id だけで、status を '予約可' にして再作成
        await client.query(
          `INSERT INTO public.customers (id, name, shop_id, status)
           VALUES ($1, $2, $3, '予約可')
           ON CONFLICT (id) DO NOTHING`,
          [m.sId, m.sName, tsujidoShopId]
        );
      }

      // B. マージ先 (normalId) の予約から、一番古い予約を sId の顧客に戻す
      const { rows: resRows } = await client.query(
        `SELECT id, date, start_time FROM public.reservations 
         WHERE customer_id = $1 AND shop_id = $2
         ORDER BY date ASC, start_time ASC`,
        [m.normalId, tsujidoShopId]
      );

      if (resRows.length > 0) {
        // 最も古い1件を特定
        const oldestRes = resRows[0];
        console.log(`   👉 Moving oldest reservation (Date: ${oldestRes.date}, Start: ${oldestRes.start_time}) back to s-customer "${m.sName}" (ID: ${m.sId})`);
        
        if (!DRY_RUN) {
          await client.query(
            `UPDATE public.reservations SET customer_id = $1 WHERE id = $2`,
            [m.sId, oldestRes.id]
          );
        }
      } else {
        console.log(`   ℹ️ No reservations found under match "${m.normalName}". Nothing to re-route.`);
      }
      mergeRestoreCount++;
    }
    console.log(`Merge Restore: ${mergeRestoreCount} duplicate pairs processed.`);

    if (!DRY_RUN) {
      await client.query('COMMIT');
      console.log('\n🎉 Live restore completed and committed successfully!');
    } else {
      console.log('\n🔍 Dry run restore completed. No DB data was modified.');
    }

  } catch (err) {
    if (!DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('\n❌ Error occurred during restore. Rolled back.');
    }
    throw err;
  } finally {
    await client.end();
  }
}

runRestore().catch(err => {
  console.error(err);
  process.exit(1);
});
