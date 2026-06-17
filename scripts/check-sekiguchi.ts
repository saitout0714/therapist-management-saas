import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DEVELOPMENT_DATABASE_URL;
const tsujidoShopId = '92c51e51-339b-48ce-8535-0f45c859b195';
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
    // 🔗 Duplicate found: "ｓこばやし2590" (ID: 34c058fc-23d4-43e5-b3c5-bffe8e919ed7) -> "こばやし2590" (ID: 7130d394-e2b7-4b75-9c06-97e79a0b7c9e)
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
    // ✏️ Rename needed (no duplicate): "ｓしろ8091" -> "しろ8091"
    const renameMatch = line.match(/✏️ Rename needed \(no duplicate\): "([^"]+)" -> "([^"]+)"/);
    if (renameMatch) {
      renames.push({
        oldName: renameMatch[1],
        newName: renameMatch[2]
      });
      continue;
    }

    // 3. 電話番号更新（新規登録）の検出
    // 📞 Match found! Naming: "むらかみ3498" (DB) <= "近藤　求人" (vCard: 09015753498)
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
    // ⚠️ Phone mismatch for "さとう1899": DB="09080031899" vs vCard="09089171899". Updating to vCard.
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

const shopId = 'dc3caa06-fcc2-4bdc-b063-7969296efd34'; // こころリンス浅草橋
const vcfPath = path.resolve(process.cwd(), 'やまもと9176🆖くらた.vcf');

function searchVCF() {
  console.log('=== SEARCHING VCARD FILE FOR OKAMOTO ===');
  const content = fs.readFileSync(vcfPath, 'utf-8');
  const blocks = content.split('BEGIN:VCARD');
  
  let foundCount = 0;
  for (const block of blocks) {
    if (block.includes('5707') || block.includes('オカモト') || block.includes('おかもと') || block.includes('岡本')) {
      console.log('--- Found Block ---');
      console.log(block.trim());
      foundCount++;
    }
  }
  console.log(`Total blocks found in VCF: ${foundCount}`);
}

async function searchDB() {
  console.log('\n=== SEARCHING DATABASE FOR OKAMOTO ===');
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const { rows: results } = await client.query(
      `SELECT id, name, phone FROM public.customers 
       WHERE shop_id = $1 AND (name LIKE '%おかもと%' OR name LIKE '%オカモト%' OR name LIKE '%5707%')`,
      [shopId]
    );
    console.log('Database search results:', results);
  } finally {
    await client.end();
  }
}

async function main() {
  searchVCF();
  await searchDB();
}

main().catch(console.error);
