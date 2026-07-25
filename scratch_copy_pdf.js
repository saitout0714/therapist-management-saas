const fs = require('fs');
const path = require('path');

const artifactDir = 'C:\\Users\\saitou-cyberpunk\\.gemini\\antigravity\\brain\\53f235ce-29e5-4e7e-899a-b4e029e4f366';

// PDFファイルをアーティファクトディレクトリへコピー
fs.copyFileSync('baccarat_owner_manual.pdf', path.join(artifactDir, 'baccarat_owner_manual.pdf'));
fs.copyFileSync('baccarat_owner_manual_print.html', path.join(artifactDir, 'baccarat_owner_manual_print.html'));
fs.copyFileSync('manual_customers.png', path.join(artifactDir, 'manual_customers.png'));
fs.copyFileSync('manual_therapists.png', path.join(artifactDir, 'manual_therapists.png'));

console.log("=== アーティファクトディレクトリへのPDF・画像のコピー完了 ===");
