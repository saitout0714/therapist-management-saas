import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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
    name: '淑女 of 秘密スパ',
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

  // Let's create index maps for DB customers
  const dbByNum = new Map<string, any>();
  const dbByName = new Map<string, any[]>();

  for (const db of dbCustomers) {
    const num = extractMemberNum(db.name, config.digits);
    const clean = cleanName(db.name, config.digits);
    if (num) {
      dbByNum.set(num, db);
    }
    if (clean) {
      if (!dbByName.has(clean)) {
        dbByName.set(clean, []);
      }
      dbByName.get(clean)!.push(db);
    }
  }

  let updatedCount = 0;
  let alreadyMatchingCount = 0;
  let insertedCount = 0;

  // Set of VCF contact phones that were matched
  const matchedContactIndices = new Set<number>();

  // Step 1: Match and update existing customer records
  console.log('\n--- Step 1: Matching and updating existing database records ---');
  for (let idx = 0; idx < contacts.length; idx++) {
    const c = contacts[idx];
    let match: any | null = null;
    let matchType = '';

    if (c.memberNum && dbByNum.has(c.memberNum)) {
      match = dbByNum.get(c.memberNum);
      matchType = 'Member Number';
    } else if (c.namePart && dbByName.has(c.namePart)) {
      const candidates = dbByName.get(c.namePart)!;
      if (candidates.length === 1) {
        const candidateDb = candidates[0];
        const dbNum = extractMemberNum(candidateDb.name, config.digits);
        // If both have member numbers, they must match!
        if (c.memberNum && dbNum) {
          if (c.memberNum === dbNum) {
            match = candidateDb;
            matchType = 'Clean Name';
          }
        } else {
          // One or both do not have member number, we can match by name
          match = candidateDb;
          matchType = 'Clean Name';
        }
      }
    }

    if (match) {
      matchedContactIndices.add(idx);
      // Clean DB phone to match standard VCF format (remove spaces)
      const cleanDbPhone = match.phone ? match.phone.replace(/\s+/g, '') : null;
      if (cleanDbPhone === c.phone) {
        alreadyMatchingCount++;
      } else {
        updatedCount++;
        console.log(`📞 Match [${matchType}]! DB: "${match.name}" (${match.phone || 'no phone'}) <==> VCF: "${c.rawName}" (${c.phone})`);
        
        if (!DRY_RUN) {
          // Update existing phone number
          await client.query(
            `UPDATE public.customers SET phone = $1 WHERE id = $2`,
            [c.phone, match.id]
          );
        }
      }
    }
  }

  // Step 2: Insert remaining unmatched VCF contacts as new customer records
  console.log('\n--- Step 2: Inserting unmatched VCF contacts as new customers ---');
  for (let i = 0; i < contacts.length; i++) {
    if (matchedContactIndices.has(i)) continue;

    const c = contacts[i];
    const cleanedName = c.rawName.replace(/様|さま/g, '').trim();

    console.log(`➕ New Customer: Name: "${cleanedName}" | Phone: "${c.phone}"`);
    insertedCount++;

    if (!DRY_RUN) {
      await client.query(
        `INSERT INTO public.customers (id, shop_id, name, phone, status, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, '予約可', NOW())`,
        [config.id, cleanedName, c.phone]
      );
    }
  }

  console.log(`\nResults for ${config.name}:`);
  console.log(`- Updated existing customers: ${updatedCount}`);
  console.log(`- Already matching phone number: ${alreadyMatchingCount}`);
  console.log(`- Inserted new customers: ${insertedCount}`);
}

async function run() {
  console.log(`🚀 VCF Full Contacts Importer (Matches + Non-Reservation Customers)`);
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
