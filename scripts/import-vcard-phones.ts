import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// DRY_RUN=true の場合は実際にDBを更新しない
const DRY_RUN = process.env.DRY_RUN !== 'false';
const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DEVELOPMENT_DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: PRODUCTION_DATABASE_URL or DEVELOPMENT_DATABASE_URL is not set.');
  process.exit(1);
}

// Shop configuration mapping
const SHOP_MAPPING: Record<string, { id: string; name: string }> = {
  tsujido: { id: '92c51e51-339b-48ce-8535-0f45c859b195', name: '辻堂茅ヶ崎' },
  crystal: { id: '1faab510-3c7e-4a01-9ce6-d3b93bbdad81', name: 'クリスタルスパ' },
  urazuma: { id: 'da3ac7a8-e84d-4dbd-830c-81e9e8b6631a', name: '裏妻SPA' },
  kokoro: { id: 'dc3caa06-fcc2-4bdc-b063-7969296efd34', name: 'こころリンス浅草橋' }
};

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('\n❌ 使用方法が正しくありません。');
  console.error('Usage: npx tsx scripts/import-vcard-phones.ts <shop_slug> <vcf_filename>');
  console.error('例: npx tsx scripts/import-vcard-phones.ts tsujido tsujido_contacts.vcf\n');
  console.error('対応店舗スラグ (<shop_slug>):');
  Object.keys(SHOP_MAPPING).forEach(slug => {
    console.error(`  - ${slug} : ${SHOP_MAPPING[slug].name}`);
  });
  process.exit(1);
}

const shopSlug = args[0].toLowerCase();
const vcfFilename = args[1];

const shopConfig = SHOP_MAPPING[shopSlug];
if (!shopConfig) {
  console.error(`❌ Error: 指定された店舗スラグ "${shopSlug}" は存在しません。`);
  process.exit(1);
}

const shopId = shopConfig.id;
const vcfPath = path.resolve(process.cwd(), vcfFilename);

if (!fs.existsSync(vcfPath)) {
  console.error(`❌ Error: 指定された vCard ファイルが見つかりません: ${vcfPath}`);
  process.exit(1);
}

interface Contact {
  name: string;
  phone: string;
  last4: string;
}

// vCard ファイルをパースする関数
function parseVCF(filePath: string): Contact[] {
  console.log(`📖 Reading vCard file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const blocks = content.split('BEGIN:VCARD');
  const contacts: Contact[] = [];

  for (const block of blocks) {
    if (!block.trim()) continue;

    // FN: または N: から名前を取得
    const fnMatch = block.match(/FN:(.+)/);
    const nMatch = block.match(/N:(.+)/);
    let name = '';
    if (fnMatch) {
      name = fnMatch[1].trim();
    } else if (nMatch) {
      name = nMatch[1].trim().replace(/;/g, '');
    }

    // TEL から電話番号を取得
    const telMatch = block.match(/TEL.*:(.+)/);
    if (telMatch) {
      let phoneRaw = telMatch[1].trim();
      
      // +81 形式の正規化（+819012345678 -> 09012345678）
      let phone = phoneRaw.replace(/[^0-9+]/g, '');
      if (phone.startsWith('+81')) {
        phone = '0' + phone.substring(3);
      }
      phone = phone.replace(/[^0-9]/g, ''); // 数字のみにする

      if (phone.length >= 4) {
        const last4 = phone.slice(-4);
        contacts.push({ name, phone, last4 });
      }
    }
  }

  console.log(`✅ Parsed ${contacts.length} contacts from vCard file.`);
  return contacts;
}

// カタカナをひらがなに変換する関数
function katakanaToHiragana(src: string): string {
  return src.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

// 名前をクレンジング（正規化）する関数
function normalizeName(name: string): string {
  if (!name) return '';
  // 1. 小文字化
  let res = name.toLowerCase();
  
  // 2. 接頭辞 s / ｓ / S / Ｓ の除去（名前の先頭にある場合）
  res = res.replace(/^[sｓ]/i, '');

  // 3. 全角英数字を半角英数字に変換（数字の除去用）
  res = res.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));

  // 4. 数字の除去
  res = res.replace(/[0-9]/g, '');

  // 5. カタカナをひらがなに変換
  res = katakanaToHiragana(res);

  // 6. 「様」「さま」「🆖」「‼️」「出禁」「新規」などの一般的なノイズ文字の除去
  res = res.replace(/様|さま/g, '');
  res = res.replace(/[!！?？#＃$＄%％&＆*＊+＋-－\/／:：;；=＝@＠\[\]\\^_`{|}~~。、・…]|[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '');
  res = res.replace(/新規|出禁/g, '');

  // 7. 空白文字の除去
  res = res.replace(/\s+/g, '');

  return res;
}

// 複数候補の中から名前の類似度をベースに最適な1件を絞り込む
function findBestMatch(contactName: string, candidates: any[]): any | null {
  const normContact = normalizeName(contactName);
  if (!normContact) return null;

  // 1. 完全一致をチェック
  const exactMatches = candidates.filter(c => normalizeName(c.name) === normContact);
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  // 2. 部分一致をチェック（どちらかが他方を含んでいる）
  const substringMatches = candidates.filter(c => {
    const normCand = normalizeName(c.name);
    if (!normCand) return false;
    return normContact.includes(normCand) || normCand.includes(normContact);
  });

  if (substringMatches.length === 1) {
    return substringMatches[0];
  }

  return null;
}


async function run() {
  console.log(`🚀 Customer Data Migration & Cleansing Tool`);
  console.log(`MODE: ${DRY_RUN ? '🔍 DRY RUN (No database updates)' : '💾 LIVE RUN (Database will be updated)'}`);
  console.log(`Database: ${dbUrl.split('@')[1] || 'URL'}`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const contacts = parseVCF(vcfPath);

    // --- STEP 1: データベースから「こころリンス」の全顧客を取得 ---
    console.log('\n--- Step 1: Loading customers from database ---');
    const { rows: dbCustomers } = await client.query(
      `SELECT id, name, phone, email, memo FROM public.customers WHERE shop_id = $1`,
      [shopId]
    );
    console.log(`Loaded ${dbCustomers.length} customers from DB.`);

    // 接頭辞 s / ｓ / S / Ｓ のいずれかで始まるか判定するヘルパー
    const hasSPrefix = (name: string) => {
      return name.startsWith('s') || name.startsWith('ｓ') || name.startsWith('S') || name.startsWith('Ｓ');
    };

    // 先頭の1文字（sの接頭辞）を除去するヘルパー
    const removeSPrefix = (name: string) => {
      return hasSPrefix(name) ? name.substring(1) : name;
    };

    // --- STEP 2: 重複顧客（s付き & sなし）の判定とマージ ---
    console.log('\n--- Step 2: Merging duplicate customer records ---');
    const sCustomers = dbCustomers.filter(c => hasSPrefix(c.name));
    const normalCustomers = dbCustomers.filter(c => !hasSPrefix(c.name));

    let mergedCount = 0;
    let renameCount = 0;

    // トランザクション開始
    if (!DRY_RUN) await client.query('BEGIN');

    // 既に統合されて無くなったIDを記録するセット
    const deletedCustomerIds = new Set<string>();

    for (const sCust of sCustomers) {
      const targetName = removeSPrefix(sCust.name);
      const match = normalCustomers.find(nc => nc.name === targetName);

      if (match) {
        // 重複が存在する場合 -> 統合 (マージ) する
        console.log(`🔗 Duplicate found: "${sCust.name}" (ID: ${sCust.id}) -> "${match.name}" (ID: ${match.id})`);
        
        if (!DRY_RUN) {
          // 1. reservations の customer_id を更新
          await client.query(
            `UPDATE public.reservations SET customer_id = $1 WHERE customer_id = $2`,
            [match.id, sCust.id]
          );

          // 2. customer_therapist_ng の customer_id を更新
          await client.query(
            `UPDATE public.customer_therapist_ng SET customer_id = $1 WHERE customer_id = $2`,
            [match.id, sCust.id]
          );

          // 3. email や memo などの情報を sなし側 が空の場合に補完する
          const emailUpdate = !match.email && sCust.email ? sCust.email : null;
          const memoUpdate = !match.memo && sCust.memo ? sCust.memo : null;
          if (emailUpdate || memoUpdate) {
            await client.query(
              `UPDATE public.customers SET 
                email = COALESCE(email, $1),
                memo = COALESCE(memo, $2)
               WHERE id = $3`,
              [emailUpdate, memoUpdate, match.id]
            );
          }

          // 4. sあり顧客レコードの削除
          await client.query(`DELETE FROM public.customers WHERE id = $1`, [sCust.id]);
        }
        deletedCustomerIds.add(sCust.id);
        mergedCount++;
      } else {
        // 重複が存在しない場合 -> 単に先頭の 's' を削除する (リネーム)
        console.log(`✏️ Rename needed (no duplicate): "${sCust.name}" -> "${targetName}"`);
        if (!DRY_RUN) {
          await client.query(
            `UPDATE public.customers SET name = $1 WHERE id = $2`,
            [targetName, sCust.id]
          );
        }
        // メモリ上のレコード名も更新しておく（ステップ3で使用するため）
        sCust.name = targetName;
        renameCount++;
      }
    }

    console.log(`\nDuplicate Merge Results:`);
    console.log(`- Merged and deleted s-prefixed duplicates: ${mergedCount} pairs`);
    console.log(`- Renamed s-prefixed customers (no duplicates): ${renameCount} records`);

    // クレンジング後の最新の顧客リストをメモリ上で再構築
    const activeCustomers = dbCustomers
      .filter(c => !deletedCustomerIds.has(c.id))
      .map(c => {
        // 統合された情報があるかもしれないが、基本はメモリ上での簡易な名前更新だけでマッチングには十分
        return c;
      });

    // --- STEP 3: 電話番号のマッチングと更新 ---
    console.log('\n--- Step 3: Matching and updating phone numbers ---');
    let phoneUpdatedCount = 0;
    let matchFailedCount = 0;
    let alreadyHasPhoneCount = 0;

    for (const contact of contacts) {
      // データベースから末尾4桁で部分一致する顧客を探す
      // 例: name LIKE '%9176%'
      const matchCandidates = activeCustomers.filter(c => c.name.endsWith(contact.last4));

      let targetCust: any | null = null;

      if (matchCandidates.length === 1) {
        targetCust = matchCandidates[0];
      } else if (matchCandidates.length > 1) {
        // 複数候補がある場合、名前の類似度判定（ひらがな化・記号除去・部分一致）を用いて絞り込む
        targetCust = findBestMatch(contact.name, matchCandidates);
        if (targetCust) {
          console.log(`💡 Resolved ambiguity for vCard [${contact.name}] (last4: ${contact.last4}) -> matched with "${targetCust.name}" (ID: ${targetCust.id})`);
        } else {
          console.log(`❌ Multiple match candidates for vCard [${contact.name}] (last4: ${contact.last4}) and could not resolve:`);
          matchCandidates.forEach(c => console.log(`   - "${c.name}" (ID: ${c.id})`));
          matchFailedCount++;
          continue;
        }
      }

      if (targetCust) {
        if (targetCust.phone) {
          // 既に電話番号が登録されている場合
          if (targetCust.phone === contact.phone) {
            alreadyHasPhoneCount++;
          } else {
            console.log(`⚠️ Phone mismatch for "${targetCust.name}": DB="${targetCust.phone}" vs vCard="${contact.phone}". Updating to vCard.`);
            if (!DRY_RUN) {
              await client.query(
                `UPDATE public.customers SET phone = $1 WHERE id = $2`,
                [contact.phone, targetCust.id]
              );
            }
            targetCust.phone = contact.phone; // メモリ上も更新
            phoneUpdatedCount++;
          }
        } else {
          // 電話番号が空の場合 -> 登録する
          console.log(`📞 Match found! Naming: "${targetCust.name}" (DB) <= "${contact.name}" (vCard: ${contact.phone})`);
          if (!DRY_RUN) {
            await client.query(
              `UPDATE public.customers SET phone = $1 WHERE id = $2`,
              [contact.phone, targetCust.id]
            );
          }
          targetCust.phone = contact.phone; // メモリ上も更新
          phoneUpdatedCount++;
        }
      } else {
        // 1件もマッチしない場合
        matchFailedCount++;
      }
    }

    console.log(`\nPhone Import Results:`);
    console.log(`- Successfully updated/registered phone numbers: ${phoneUpdatedCount} records`);
    console.log(`- Already had correct phone numbers: ${alreadyHasPhoneCount} records`);
    console.log(`- Unmatched or ambiguous contacts: ${matchFailedCount} records`);

    if (!DRY_RUN) {
      await client.query('COMMIT');
      console.log('\n🎉 Live run completed and transaction committed successfully!');
    } else {
      console.log('\n🔍 Dry run completed. No data was modified.');
    }

  } catch (err) {
    if (!DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('\n❌ Error occurred. Transaction rolled back.');
    }
    throw err;
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
