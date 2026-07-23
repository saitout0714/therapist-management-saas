const fs = require('fs');

function fixBOM(path) {
  let content = fs.readFileSync(path);
  // Remove BOM if present (EF BB BF)
  if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
    content = content.slice(3);
    fs.writeFileSync(path, content);
    console.log('Fixed BOM for', path);
  }
}

function fixSJIS(path) {
  // if not BOM, might be Windows-1252 / SJIS from powershell set-content
  // If it's broken, I should restore from git
}

fixBOM('app/api/sync/therapists/estama/route.ts');
fixBOM('app/api/sync/therapists/esthe-ranking/route.ts');
