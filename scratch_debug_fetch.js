const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function parseThemeColor(colorInput) {
  if (!colorInput) {
    return {
      primary: '#d1b464',
      accent: '#a39573',
      darkBg: '#464646',
      lightBg: '#faf7f0',
    };
  }
  if (typeof colorInput === 'string') {
    return {
      primary: colorInput,
      accent: colorInput,
      darkBg: '#464646',
      lightBg: '#faf7f0',
    };
  }
  return {
    primary: colorInput.primary || '#d1b464',
    accent: colorInput.accent || '#a39573',
    darkBg: colorInput.darkBg || '#464646',
    lightBg: colorInput.lightBg || '#faf7f0',
  };
}

async function fetchStoreConfig(slug) {
  let { data } = await supabase
    .from('shops')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) {
    const { data: byName } = await supabase
      .from('shops')
      .select('*')
      .ilike('name', slug)
      .maybeSingle();
    data = byName;
  }

  if (!data) {
    const { data: byId } = await supabase
      .from('shops')
      .select('*')
      .eq('id', slug)
      .maybeSingle();
    data = byId;
  }

  if (!data) {
    return {
      id: 'mock',
      slug: 'specialgrade',
      name: 'Special Grade',
      catchphrase: '赤羽・川口 メンズエステ ～上質で優雅な至福の空間～',
      logoUrl: undefined,
    };
  }

  return {
    id: data.id,
    slug: data.slug || slug,
    name: data.name || 'Special Grade',
    catchphrase: data.catchphrase || '赤羽・川口 メンズエステ ～上質で優雅な至福の空間～',
    logoUrl: data.logo_url || undefined,
    themeColor: parseThemeColor(data.theme_color),
    address: data.address || '東京都北区赤羽 / 埼玉県川口市',
    accessInfo: data.access_info || '赤羽駅徒歩2分・川口駅徒歩3分',
    businessHours: data.business_hours || 'OPEN/11:00～5:00 (受付/10:30〜2:00)',
    phoneNumber: data.phone || '070-1462-0389',
    noticeBanner: data.notice_banner || '✨ 赤羽・川口エリアで選ばれ続ける最高級メンズエステ ✨',
  };
}

async function test() {
  const res = await fetchStoreConfig('specialgrade');
  console.log('fetchStoreConfig result:', JSON.stringify(res, null, 2));
}

test();
