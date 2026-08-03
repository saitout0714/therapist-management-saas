const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 美しいゴールドエンブレムのロゴSVGデータ
const goldLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" width="400" height="100">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f6d365" />
      <stop offset="50%" stop-color="#d1b464" />
      <stop offset="100%" stop-color="#b8860b" />
    </linearGradient>
  </defs>
  <g transform="translate(10, 10)">
    <!-- クラウン/エンブレムアイコン -->
    <path d="M 40 10 L 50 35 L 75 20 L 65 55 L 15 55 L 5 20 L 30 35 Z" fill="url(#goldGrad)" />
    <circle cx="40" cy="68" r="4" fill="#d1b464" />
    <circle cx="20" cy="68" r="3" fill="#d1b464" />
    <circle cx="60" cy="68" r="3" fill="#d1b464" />
    <!-- 店舗名テキスト -->
    <text x="90" y="48" font-family="Cinzel, serif, Georgia" font-size="32" font-weight="900" fill="url(#goldGrad)" letter-spacing="2">SPECIAL GRADE</text>
    <text x="92" y="70" font-family="serif" font-size="12" fill="#8c7853" letter-spacing="4">LUXURY SPA &amp; ESTHETIQUE</text>
  </g>
</svg>`;

const logoDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(goldLogoSvg)}`;

async function run() {
  const { data, error } = await supabase
    .from('shops')
    .update({ logo_url: logoDataUrl })
    .ilike('name', '%SpecialGrade%')
    .select();

  if (error) {
    console.error('Error updating shop logo:', error);
  } else {
    console.log('Successfully updated SpecialGrade logo_url to Data URL!');
  }
}

run();
