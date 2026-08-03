const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 完全エスケープ済みの美しいゴールド王冠エンブレムSVG
const goldLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80" width="320" height="80">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f6d365" />
      <stop offset="50%" stop-color="#d1b464" />
      <stop offset="100%" stop-color="#b8860b" />
    </linearGradient>
  </defs>
  <g transform="translate(5, 5)">
    <!-- 王冠アイコン -->
    <path d="M 35 12 L 45 32 L 65 18 L 56 48 L 14 48 L 5 18 L 25 32 Z" fill="url(#gold)" />
    <circle cx="35" cy="58" r="3.5" fill="#d1b464" />
    <circle cx="18" cy="58" r="2.5" fill="#d1b464" />
    <circle cx="52" cy="58" r="2.5" fill="#d1b464" />
    <!-- ブランドテキスト -->
    <text x="75" y="38" font-family="serif" font-size="24" font-weight="bold" fill="url(#gold)" letter-spacing="1.5">Special Grade</text>
    <text x="76" y="56" font-family="sans-serif" font-size="9" fill="#a39573" letter-spacing="2">LUXURY ESTHETIC</text>
  </g>
</svg>`;

// Base64にエンコード
const base64DataUrl = `data:image/svg+xml;base64,${Buffer.from(goldLogoSvg).toString('base64')}`;

async function run() {
  const { data, error } = await supabase
    .from('shops')
    .update({ logo_url: base64DataUrl })
    .ilike('name', '%SpecialGrade%')
    .select();

  if (error) {
    console.error('Error updating shop logo:', error);
  } else {
    console.log('Successfully updated SpecialGrade logo_url to Base64 Data URL!');
    console.log('Base64 URL:', base64DataUrl.substring(0, 80) + '...');
  }
}

run();
