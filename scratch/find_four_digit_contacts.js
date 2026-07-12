const fs = require('fs');
const path = require('path');

const vcfPath = path.resolve(__dirname, '../urban秘密.vcf');
const content = fs.readFileSync(vcfPath, 'utf-8');
const blocks = content.split('BEGIN:VCARD');

let count = 0;
for (const block of blocks) {
  if (!block.trim()) continue;

  const fnMatch = block.match(/FN:(.+)/);
  const nMatch = block.match(/N:(.+)/);
  let name = '';
  if (fnMatch) {
    name = fnMatch[1].trim();
  } else if (nMatch) {
    name = nMatch[1].trim().replace(/;/g, '');
  }

  const telMatch = block.match(/TEL.*:(.+)/);
  let phone = '';
  if (telMatch) {
    phone = telMatch[1].trim().replace(/[^0-9]/g, '');
  }

  // Check if name ends with 4 digits
  const last4Match = name.match(/\d{4}$/);
  if (last4Match) {
    count++;
    console.log(`Found #${count}: Name="${name}" | Phone="${phone}" | Last4="${last4Match[0]}"`);
  }
}
console.log(`Total contacts ending in 4 digits: ${count}`);
