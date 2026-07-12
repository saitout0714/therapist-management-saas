const fs = require('fs');
const path = require('path');

const vcfPath = path.resolve(__dirname, '../urban秘密.vcf');
const content = fs.readFileSync(vcfPath, 'utf-8');
const blocks = content.split('BEGIN:VCARD');

const prefixes = new Map();
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
    const telMatch = block.match(/TEL.*:(.+)/);
    if (telMatch) {
      let phoneRaw = telMatch[1].trim();
      let phone = phoneRaw.replace(/[^0-9+]/g, '');
      if (phone.startsWith('+81')) {
        phone = '0' + phone.substring(3);
      }
      phone = phone.replace(/[^0-9]/g, '');
      
      const prefix = phone.substring(0, 3);
      prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
      if (prefix === '03' || prefix === '04' || prefix === '05' || prefix === '06') {
        console.log(`Non-mobile: Name="${name}" | Phone="${phone}"`);
      }
    }
  }
}
console.log('Prefix distribution:', Array.from(prefixes.entries()));
