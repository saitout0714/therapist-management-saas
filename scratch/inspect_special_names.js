const fs = require('fs');
const path = require('path');

const vcfPath = path.resolve(__dirname, '../urban秘密.vcf');
const content = fs.readFileSync(vcfPath, 'utf-8');
const blocks = content.split('BEGIN:VCARD');

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

  const nameCleaned = name.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  const last4Match = nameCleaned.match(/\d{4}$/);
  if (last4Match) {
    // If it contains non-hiragana/katakana/english letters/numbers
    const baseName = nameCleaned.replace(/\d{4}$/, '');
    if (/[^\u3040-\u309f\u30a0-\u30ff\w\s]/.test(baseName)) {
      console.log(`Special name: "${name}"`);
    }
  }
}
