const fs = require('fs');
const path = require('path');

const vcfPath = path.resolve(__dirname, '../urban秘密.vcf');
const content = fs.readFileSync(vcfPath, 'utf-8');
const blocks = content.split('BEGIN:VCARD');

function cleanCustomerName(name) {
  let cleaned = name.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  const match = cleaned.match(/(\d{4})$/);
  if (!match) return null;
  const digits = match[1];
  let base = cleaned.substring(0, cleaned.length - 4);
  
  // Remove non-Japanese, non-alphanumeric characters
  base = base.replace(/[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\w]/g, '');
  
  // Remove bad words
  const badWords = /団員|新規|出禁|引き抜き注意|注意|様|さま/g;
  base = base.replace(badWords, '');
  
  return base + digits;
}

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
  if (telMatch) {
    let phoneRaw = telMatch[1].trim();
    let phone = phoneRaw.replace(/[^0-9+]/g, '');
    if (phone.startsWith('+81')) {
      phone = '0' + phone.substring(3);
    } else if (phone.startsWith('81') && phone.length > 10) {
      phone = '0' + phone.substring(2);
    }
    phone = phone.replace(/[^0-9]/g, '');
    if ((phone.startsWith('90') || phone.startsWith('80') || phone.startsWith('70')) && phone.length === 10) {
      phone = '0' + phone;
    }
    
    // Check if phone is mobile
    const isMobile = /^(090|080|070)\d{8}$/.test(phone);
    
    const cleaned = cleanCustomerName(name);
    if (cleaned && isMobile) {
      count++;
      if (name !== cleaned) {
        console.log(`Original: "${name}" -> Cleaned: "${cleaned}" | Phone: "${phone}"`);
      }
    }
  }
}
console.log(`Total cleaned mobile contacts: ${count}`);
