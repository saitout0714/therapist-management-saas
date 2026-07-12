const fs = require('fs');
const path = require('path');

const vcfPath = path.resolve(__dirname, '../urban秘密.vcf');
const content = fs.readFileSync(vcfPath, 'utf-8');
const blocks = content.split('BEGIN:VCARD');

let parsed = 0;
for (const block of blocks) {
  if (!block.trim()) continue;
  parsed++;
  if (parsed > 50) break;

  const fnMatch = block.match(/FN:(.+)/);
  const nMatch = block.match(/N:(.+)/);
  let name = '';
  if (fnMatch) {
    name = fnMatch[1].trim();
  } else if (nMatch) {
    name = nMatch[1].trim().replace(/;/g, '');
  }

  const telMatch = block.match(/TEL.*:(.+)/);
  const phoneticMatch = block.match(/X-PHONETIC-LAST-NAME:(.+)/) || block.match(/X-PHONETIC-FIRST-NAME:(.+)/);

  console.log(`Contact #${parsed}:`);
  console.log(`  Name: ${name}`);
  if (telMatch) console.log(`  Phone: ${telMatch[1].trim()}`);
  if (phoneticMatch) console.log(`  Phonetic: ${phoneticMatch[1].trim()}`);
}
