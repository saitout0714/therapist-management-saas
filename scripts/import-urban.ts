import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DRY_RUN = process.env.DRY_RUN !== 'false';
const dbUrl = process.env.PRODUCTION_DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: PRODUCTION_DATABASE_URL is not set.');
  process.exit(1);
}

const SHOPS = [
  { id: '7d430288-8aed-4381-b3bf-f35fad962d2f', name: 'アーバンスパ' },
  { id: '774101be-d8c5-4ca5-ba4a-fc61c039fbaa', name: '新宿秘密妻' }
];

interface Contact {
  rawName: string;      // Original name in VCF
  cleanedName: string;  // Cleaned name [BaseName][Last4] for registration
  baseName: string;     // Cleaned base name without digits
  phone: string;        // Normalized 11-digit mobile phone
  last4: string;        // Last 4 digits of phone
}

// Convert Katakana to Hiragana for similarity comparisons
function katakanaToHiragana(src: string): string {
  return src.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

// Normalize name for matching similarity
function normalizeNameForMatch(name: string): string {
  if (!name) return '';
  let res = name.toLowerCase();
  res = res.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  res = res.replace(/[0-9]/g, '');
  res = katakanaToHiragana(res);
  res = res.replace(/様|さま/g, '');
  res = res.replace(/[!！?？#＃$＄%％&＆*＊+＋-－\/／:：;；=＝@＠\[\]\\^_`{|}~~。、・…]|[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '');
  res = res.replace(/\s+/g, '');
  return res;
}

// Clean raw base name to store in DB
function cleanBaseName(base: string): string {
  // Remove non-Japanese, non-alphanumeric characters
  let res = base.replace(/[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\w]/g, '');
  // Remove common prefix/suffix words
  const badWords = /団員|新規|出禁|引き抜き注意|注意|様|さま/g;
  res = res.replace(badWords, '');
  return res.trim();
}

// Normalize phone number to standard 11 digits
function normalizePhone(rawPhone: string): string {
  let phone = rawPhone.replace(/[^0-9+]/g, '');
  if (phone.startsWith('+81')) {
    phone = '0' + phone.substring(3);
  } else if (phone.startsWith('81') && phone.length > 10) {
    phone = '0' + phone.substring(2);
  }
  phone = phone.replace(/[^0-9]/g, '');
  if ((phone.startsWith('90') || phone.startsWith('80') || phone.startsWith('70')) && phone.length === 10) {
    phone = '0' + phone;
  }
  return phone;
}

// Parse VCF file and extract valid mobile contacts
function parseVCF(filePath: string): Contact[] {
  console.log(`📖 Reading vCard file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const blocks = content.split('BEGIN:VCARD');
  const contacts: Contact[] = [];
  const processedPhones = new Set<string>();

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

    if (!rawName) continue;

    const telMatch = block.match(/TEL.*:(.+)/);
    if (telMatch) {
      const phone = normalizePhone(telMatch[1].trim());
      // Only process valid mobile numbers
      const isMobile = /^(090|080|070)\d{8}$/.test(phone);
      if (!isMobile) continue;

      const last4 = phone.slice(-4);
      const normalizedName = rawName.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));

      // Contact is a member if their name contains their last 4 digits of phone
      if (normalizedName.includes(last4)) {
        // Prevent duplicate phones in the same VCF file import
        if (processedPhones.has(phone)) {
          // If we see the same phone number again, we skip or use the one with the cleaner/longer name
          continue;
        }
        processedPhones.add(phone);

        const parts = normalizedName.split(last4);
        const rawBase = parts[0];
        const cleanedBase = cleanBaseName(rawBase);
        const cleanedName = cleanedBase + last4;

        contacts.push({
          rawName,
          cleanedName,
          baseName: cleanedBase,
          phone,
          last4
        });
      }
    }
  }

  console.log(`✅ Parsed ${contacts.length} unique mobile member contacts from VCF.`);
  return contacts;
}

// Name matching algorithm to find best DB customer candidate
function findBestMatch(contact: Contact, candidates: any[]): any | null {
  const normContactBase = normalizeNameForMatch(contact.baseName);
  if (!normContactBase) return null;

  // 1. Exact base name match
  const exactMatches = candidates.filter(c => {
    const candBase = c.name.replace(/\d{4}$/, '');
    return normalizeNameForMatch(candBase) === normContactBase;
  });
  if (exactMatches.length === 1) return exactMatches[0];

  // 2. Substring match
  const substringMatches = candidates.filter(c => {
    const candBase = c.name.replace(/\d{4}$/, '');
    const normCand = normalizeNameForMatch(candBase);
    if (!normCand) return false;
    return normContactBase.includes(normCand) || normCand.includes(normContactBase);
  });
  if (substringMatches.length === 1) return substringMatches[0];

  return null;
}

async function syncShop(client: Client, shop: { id: string; name: string }, contacts: Contact[]) {
  console.log(`\n=================== Shop: ${shop.name} (${shop.id}) ===================`);

  // Load existing customers for the shop
  const { rows: dbCustomers } = await client.query(
    `SELECT id, name, phone, status, memo FROM public.customers WHERE shop_id = $1`,
    [shop.id]
  );
  console.log(`Loaded ${dbCustomers.length} existing customers from DB.`);

  // Group existing customers by their last 4 digits in name
  const dbByNameLast4 = new Map<string, any[]>();
  for (const db of dbCustomers) {
    const nameCleaned = db.name.replace(/[０-９]/g, (s: string) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
    const match = nameCleaned.match(/(\d{4})$/);
    if (match) {
      const last4 = match[1];
      if (!dbByNameLast4.has(last4)) {
        dbByNameLast4.set(last4, []);
      }
      dbByNameLast4.get(last4)!.push(db);
    }
  }

  let matchedCount = 0;
  let phoneUpdatedCount = 0;
  let alreadyCorrectCount = 0;
  let insertedCount = 0;

  for (const c of contacts) {
    // Find candidates in DB that have name ending with the VCF contact's last 4 digits
    const candidates = dbByNameLast4.get(c.last4) || [];
    let match: any | null = null;

    if (candidates.length === 1) {
      match = candidates[0];
    } else if (candidates.length > 1) {
      match = findBestMatch(c, candidates);
    }

    if (match) {
      matchedCount++;
      const cleanDbPhone = match.phone ? match.phone.replace(/[^0-9]/g, '') : null;
      if (cleanDbPhone === c.phone) {
        alreadyCorrectCount++;
      } else {
        phoneUpdatedCount++;
        console.log(`📞 [UPDATE] DB Name: "${match.name}" (Phone: ${match.phone || 'None'}) <== VCF Phone: "${c.phone}" (VCF: "${c.rawName}")`);
        if (!DRY_RUN) {
          await client.query(
            `UPDATE public.customers 
             SET phone = $1, memo = COALESCE(memo, $2) 
             WHERE id = $3`,
            [c.phone, c.rawName, match.id]
          );
        }
      }
    } else {
      // Not found, insert as a new customer
      insertedCount++;
      console.log(`➕ [INSERT] Name: "${c.cleanedName}" | Phone: "${c.phone}" | Memo: "${c.rawName}"`);
      if (!DRY_RUN) {
        await client.query(
          `INSERT INTO public.customers (id, shop_id, name, phone, status, memo, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, '予約可', $4, NOW())`,
          [shop.id, c.cleanedName, c.phone, c.rawName]
        );
      }
    }
  }

  console.log(`\nResults for ${shop.name}:`);
  console.log(`- Total contacts matched with DB records: ${matchedCount}`);
  console.log(`  - Already had correct phone number: ${alreadyCorrectCount}`);
  console.log(`  - Phone number updated: ${phoneUpdatedCount}`);
  console.log(`- New customers registered: ${insertedCount}`);
}

async function run() {
  console.log(`🚀 VCF Contact Importer for アーバンスパ & 新宿秘密妻`);
  console.log(`MODE: ${DRY_RUN ? '🔍 DRY RUN (No database updates)' : '💾 LIVE RUN (Database will be updated)'}`);

  const contacts = parseVCF(path.resolve(process.cwd(), 'urban秘密.vcf'));

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    if (!DRY_RUN) {
      await client.query('BEGIN');
    }

    for (const shop of SHOPS) {
      await syncShop(client, shop, contacts);
    }

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
