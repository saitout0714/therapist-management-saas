const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 美しいゴールドエンブレムSVG
const goldLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 90" width="360" height="90">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f6d365" />
      <stop offset="50%" stop-color="#d1b464" />
      <stop offset="100%" stop-color="#b8860b" />
    </linearGradient>
  </defs>
  <g transform="translate(10, 10)">
    <!-- 王冠グラフィック -->
    <path d="M 35 10 L 45 30 L 65 15 L 56 45 L 14 45 L 5 15 L 25 30 Z" fill="url(#goldGrad)" />
    <circle cx="35" cy="55" r="3.5" fill="#d1b464" />
    <circle cx="18" cy="55" r="2.5" fill="#d1b464" />
    <circle cx="52" cy="55" r="2.5" fill="#d1b464" />
    <!-- 店舗名 -->
    <text x="80" y="38" font-family="serif, Georgia" font-size="26" font-weight="900" fill="url(#goldGrad)" letter-spacing="1.5">Special Grade</text>
    <text x="82" y="58" font-family="serif" font-size="10" fill="#a39573" letter-spacing="3">LUXURY SPA &amp; ESTHETIC</text>
  </g>
</svg>`;

const base64Logo = `data:image/svg+xml;base64,${Buffer.from(goldLogoSvg).toString('base64')}`;

// public ディレクトリにも物理保存
const publicDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.writeFileSync(path.join(publicDir, 'logo-specialgrade.svg'), goldLogoSvg);

async function run() {
  console.log('Updating DB shops table...');
  const { data: shops, error: fetchErr } = await supabase.from('shops').select('id, name, logo_url');
  console.log('Current shops:', shops);

  for (const shop of shops || []) {
    const { error: updateErr } = await supabase
      .from('shops')
      .update({ logo_url: base64Logo })
      .eq('id', shop.id);

    if (updateErr) {
      console.error(`Failed to update shop ${shop.id}:`, updateErr);
    } else {
      console.log(`Successfully updated shop ${shop.name} (${shop.id}) with new logo!`);
    }
  }
}

run();
