const fs = require('fs');

function sampleVcf(filepath, label) {
  if (!fs.existsSync(filepath)) {
    console.log(`ファイルが存在しません: ${filepath}`);
    return;
  }
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split(/\r?\n/);
  console.log(`=== ${label} (${lines.length} 行) ===`);

  let count = 0;
  let currentCard = [];
  for (const line of lines) {
    if (line.startsWith('BEGIN:VCARD')) {
      currentCard = [line];
    } else if (line.startsWith('END:VCARD')) {
      currentCard.push(line);
      count++;
      if (count <= 5) {
        console.log(`--- Card ${count} ---`);
        console.log(currentCard.join('\n'));
      }
    } else if (currentCard.length > 0) {
      currentCard.push(line);
    }
  }
}

sampleVcf('shuunan.vcf', 'バカラ周南下松 (shuunan.vcf)');
sampleVcf('yamaguti.vcf', 'バカラ山口湯田 (yamaguti.vcf)');
sampleVcf('ube.vcf', 'バカラ宇部 (ube.vcf)');
