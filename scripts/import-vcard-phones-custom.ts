import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// DRY_RUN=true の場合は実際にDBを更新しない
const DRY_RUN = process.env.DRY_RUN !== 'false';
const dbUrl = process.env.PRODUCTION_DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: PRODUCTION_DATABASE_URL is not set.');
  process.exit(1);
}

interface ShopConfig {
  id: string;
  name: string;
  vcfFile: string;
  digits: number;
}

const SHOPS: Record<string, ShopConfig> = {
  rosecafe: {
    id: 'a0000001-0000-0000-0000-000000000005',
    name: 'ローズカフェ',
    vcfFile: 'rosecafe.vcf',
    digits: 5
  },
  shukujyo: {
    id: '3464ed8c-44e8-46f1-b701-9b6ae0f465a8',
    name: '淑女の秘密スパ',
    vcfFile: 'shukujyo.vcf',
    digits: 4
  }
};

interface Contact {
  rawName: string;
  namePart: string;
  memberNum: string | null;
  phone: string;
}

// Convert Katakana to Hiragana
function katakanaToHiragana(src: string): string {
  return src.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

function extractMemberNum(name: string, numDigits: number): string | null {
  let cleaned = name.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  const regex = new RegExp(`\\b\\d{${numDigits}}\\b|\\d{${numDigits}}`);
  const match = cleaned.match(regex);
  return match ? match[0] : null;
}

function cleanName(name: string, numDigits: number): string {
  if (!name) return '';
  let res = name.toLowerCase();
  
  res = res.replace(/^[sｓ]/i, '');
  res = res.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));

  const memberNum = extractMemberNum(name, numDigits);
  if (memberNum) {
    res = res.replace(memberNum, '');
  }

  res = katakanaToHiragana(res);
  res = res.replace(/様|さま/g, '');
  res = res.replace(/新規|出禁/g, '');
  res = res.replace(/[!！?？#＃$＄%％&＆*＊+＋-－\/／:：;；=＝@＠\[\]\\^_`{|}~~。、・…]|[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '');
  res = res.replace(/\s+/g, '');

  return res;
}

function parseVCF(filePath: string, numDigits: number): Contact[] {
  console.log(`📖 Reading vCard file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const blocks = content.split('BEGIN:VCARD');
  const contacts: Contact[] = [];

  for (const block of blocks) {
    if (!block.trim()) continue;

    const fnMatch = block.match(/FN:(.+)/);
    const nMatch = block.match(/N:(.+)/);
    let rawName = '';
    if (fnMatch) {
      rawName = fnMatch[1].trim();
    } else if (nMatch) {
      rawName = nMatch[1].trim().replace(/;/g, '');
    }

    if (!rawName || rawName === 'mts mts') continue;

    const telMatch = block.match(/TEL.*:(.+)/);
    if (telMatch) {
      let phoneRaw = telMatch[1].trim();
      let phone = phoneRaw.replace(/[^0-9+]/g, '');
      if (phone.startsWith('+81')) {
        phone = '0' + phone.substring(3);
      }
      phone = phone.replace(/[^0-9]/g, '');

      const memberNum = extractMemberNum(rawName, numDigits);
      const namePart = cleanName(rawName, numDigits);
      contacts.push({ rawName, namePart, memberNum, phone });
    }
  }
  console.log(`✅ Parsed ${contacts.length} contacts from VCF.`);
  return contacts;
}

async function syncShop(client: Client, config: ShopConfig) {
  console.log(`\n=================== Shop: ${config.name} (${config.id}) ===================`);
  
  const contacts = parseVCF(config.vcfFile, config.digits);
  
  const { rows: dbCustomers } = await client.query(
    `SELECT id, name, phone, memo FROM public.customers WHERE shop_id = $1`,
    [config.id]
  );
  console.log(`Loaded ${dbCustomers.length} customers from DB.`);

  let memberNumMatches = 0;
  let nameMatchesOnly = 0;
  let alreadyMatchedCount = 0;
  let unmatchedCount = 0;

  // Let's create helper maps
  const contactsByNum = new Map<string, Contact>();
  const contactsByName = new Map<string, Contact[]>();

  for (const c of contacts) {
    if (c.memberNum) {
      contactsByNum.set(c.memberNum, c);
    }
    if (c.namePart) {
      if (!contactsByName.has(c.namePart)) {
        contactsByName.set(c.namePart, []);
      }
      contactsByName.get(c.namePart)!.push(c);
    }
  }

  for (const db of dbCustomers) {
    const dbNum = extractMemberNum(db.name, config.digits);
    const dbClean = cleanName(db.name, config.digits);

    let match: Contact | null = null;
    let matchType = '';

    if (dbNum && contactsByNum.has(dbNum)) {
      match = contactsByNum.get(dbNum)!;
      matchType = 'Member Number';
    } else if (dbClean && contactsByName.has(dbClean)) {
      const candidates = contactsByName.get(dbClean)!;
      if (candidates.length === 1) {
        match = candidates[0];
        matchType = 'Clean Name';
      }
    }

    if (match) {
      if (db.phone === match.phone) {
        alreadyMatchedCount++;
      } else {
        if (matchType === 'Member Number') {
          memberNumMatches++;
        } else {
          nameMatchesOnly++;
        }

        console.log(`📞 Match [${matchType}]! DB: "${db.name}" (${db.phone || 'no phone'}) <==> VCF: "${match.rawName}" (${match.phone})`);
        
        if (!DRY_RUN) {
          await client.query(
            `UPDATE public.customers SET phone = $1 WHERE id = $2`,
            [match.phone, db.id]
          );
        }
      }
    } else {
      unmatchedCount++;
    }
  }

  console.log(`\nResults for ${config.name}:`);
  console.log(`- Updated by member number match: ${memberNumMatches}`);
  console.log(`- Updated by clean name match: ${nameMatchesOnly}`);
  console.log(`- Already matching phone number: ${alreadyMatchedCount}`);
  console.log(`- Unmatched customers: ${unmatchedCount}`);
}

async function run() {
  console.log(`🚀 Custom VCF Phone Importer`);
  console.log(`MODE: ${DRY_RUN ? '🔍 DRY RUN (No database updates)' : '💾 LIVE RUN (Database will be updated)'}`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    if (!DRY_RUN) {
      await client.query('BEGIN');
    }

    await syncShop(client, SHOPS.rosecafe);
    await syncShop(client, SHOPS.shukujyo);

    if (!DRY_RUN) {
      await client.query('COMMIT');
      console.log('\n🎉 Transaction committed successfully!');
    } else {
      console.log('\n🔍 Dry run completed successfully.');
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

run().catch(console.error);
