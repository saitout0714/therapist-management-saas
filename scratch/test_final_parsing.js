const fs = require('fs');
const path = require('path');

const vcfPath = path.resolve(__dirname, '../urban秘密.vcf');
const content = fs.readFileSync(vcfPath, 'utf-8');
const blocks = content.split('BEGIN:VCARD');

function normalizePhone(rawPhone) {
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

function cleanBaseName(base) {
  // Remove non-Japanese, non-alphanumeric characters
  let res = base.replace(/[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\w]/g, '');
  // Remove bad words
  const badWords = /団員|新規|出禁|引き抜き注意|注意|様|さま/g;
  res = res.replace(badWords, '');
  return res.trim();
}

let matchedCount = 0;
let bannedCount = 0;

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

  const telMatch = block.match(/TEL.*:(.+)/);
  if (telMatch) {
    const phone = normalizePhone(telMatch[1].trim());
    const isMobile = /^(090|080|070)\d{8}$/.test(phone);
    if (!isMobile) continue;

    const last4 = phone.slice(-4);
    
    // Convert full-width numbers in rawName to half-width for matching
    const normalizedName = rawName.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
    
    if (normalizedName.includes(last4)) {
      matchedCount++;
      const parts = normalizedName.split(last4);
      const rawBase = parts[0];
      const cleanedBase = cleanBaseName(rawBase);
      const finalName = cleanedBase + last4;
      const isBanned = rawName.includes('出禁');
      if (isBanned) bannedCount++;

      console.log(`Match #${matchedCount}: VCF="${rawName}" -> Reg="${finalName}" | Phone="${phone}" | Status="${isBanned ? '出禁' : '予約可'}"`);
    }
  }
}

console.log(`\nMatched mobile contacts ending in last4: ${matchedCount}`);
console.log(`Banned contacts: ${bannedCount}`);
