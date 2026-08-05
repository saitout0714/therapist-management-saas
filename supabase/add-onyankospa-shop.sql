-- ============================================================================
-- 新店「おニャンこスパ」の店舗登録およびフルプラン（HP + Web予約 + 代行）設定
--
-- 作成日 : 2026-08-05
-- 適用先 : PRODUCTION DATABASE
-- 内容   : おニャンこスパ(slug: onyankospa)の新規追加および契約プラン設定
-- ============================================================================

INSERT INTO public.shops (
    name,
    slug,
    catchphrase,
    access_info,
    business_hours,
    address,
    phone,
    x_url,
    line_url,
    litlink_url,
    notice_banner,
    template_id,
    theme_color,
    plan,
    has_hp,
    has_reserve,
    has_agency
) VALUES (
    'おニャンこスパ',
    'onyankospa',
    '〜サイバーネオンと極上密着空間〜 メンズエステ',
    '新宿駅東口徒歩3分・渋谷駅ハチ公口徒歩4分',
    'OPEN/11:00～5:00 (受付/10:30〜3:30)',
    '東京都新宿区歌舞伎町 / 渋谷区道玄坂',
    '070-7431-3060',
    'https://x.com',
    'https://line.me',
    'https://lit.link',
    '🐾 おニャンこスパ グランドオープン！新規ご来店で¥2,000 OFFキャンペーン開催中 🐾',
    'cute',
    '{"primary":"#ff007f","accent":"#ff2a8d","darkBg":"#050014","lightBg":"#1a0933"}',
    'full_plan',
    true,   -- HPあり
    true,   -- Web予約あり
    true    -- 代行管理あり
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    catchphrase = EXCLUDED.catchphrase,
    access_info = EXCLUDED.access_info,
    business_hours = EXCLUDED.business_hours,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    notice_banner = EXCLUDED.notice_banner,
    template_id = EXCLUDED.template_id,
    theme_color = EXCLUDED.theme_color,
    has_hp = true,
    has_reserve = true,
    has_agency = true;
