import { supabase } from './supabase';
import {
  MOCK_STORE,
  MOCK_CAMPAIGNS,
  MOCK_THERAPISTS,
  MOCK_BLOG_ARTICLES,
  MOCK_NEWS,
  MOCK_SYSTEM_MENU,
} from '../mock/specialgrade';
import {
  MOCK_ONYANKO_STORE,
  MOCK_ONYANKO_CAMPAIGNS,
  MOCK_ONYANKO_THERAPISTS,
  MOCK_ONYANKO_BLOG_ARTICLES,
  MOCK_ONYANKO_NEWS,
  MOCK_ONYANKO_SYSTEM_MENU,
} from '../mock/onyankospa';
import {
  StoreConfig,
  Therapist,
  Campaign,
  BlogArticle,
  NewsItem,
  SystemMenuCategory,
  CourseOption,
} from '../types/store';

// 実写真が未登録のセラピストに使うプレースホルダー（他店舗のモック人物写真を誤って出さないため）
const NO_IMAGE_THERAPIST = '/images/no-image-therapist.svg';

// 店舗の営業日切り替え時刻（shop_back_rules.business_day_cutoff）を取得する。
// 未設定の場合はDBのデフォルトと同じ '06:00' を返す。
export async function fetchBusinessDayCutoff(shopId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('shop_back_rules')
      .select('business_day_cutoff')
      .eq('shop_id', shopId)
      .maybeSingle();
    const raw = (data as any)?.business_day_cutoff as string | undefined;
    return raw ? raw.slice(0, 5) : '06:00';
  } catch {
    return '06:00';
  }
}

// JST基準・営業日切り替え時刻考慮で「現在の営業日」の日付文字列 (YYYY-MM-DD) を返す。
// 深夜営業（例: 19:00〜28:00）のシフトは、実時計が日付を跨いでも切り替え時刻までは
// 前日の営業日として扱う。単純な `new Date().toISOString()` では日付が0時（またはUTC基準）
// で切り替わってしまい、深夜シフト中の「本日出勤」判定がずれる。
export function getJstBusinessDateStr(cutoff: string = '06:00'): string {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const jstDate = new Date(utcTime + 9 * 3600000);

  const [cutH, cutM] = cutoff.split(':').map(Number);
  const currentJstMinutes = jstDate.getHours() * 60 + jstDate.getMinutes();
  const cutoffMinutes = (cutH ?? 6) * 60 + (cutM ?? 0);

  const businessDate = new Date(jstDate);
  if (currentJstMinutes < cutoffMinutes) {
    businessDate.setDate(businessDate.getDate() - 1);
  }

  const y = businessDate.getFullYear();
  const m = String(businessDate.getMonth() + 1).padStart(2, '0');
  const d = String(businessDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseThemeColor(colorInput: any, templateId?: string): StoreConfig['themeColor'] {
  // テンプレート指定によるデフォルトプリセットカラー
  let presetPrimary = '#d1b464';
  let presetAccent = '#a39573';
  let presetLightBg = '#faf7f0';

  if (templateId === 'cute') {
    presetPrimary = '#ff6b8b';
    presetAccent = '#e05270';
    presetLightBg = '#fff0f3';
  } else if (templateId === 'modern') {
    presetPrimary = '#333333';
    presetAccent = '#c5a059';
    presetLightBg = '#f4f4f5';
  } else if (templateId === 'minimal') {
    presetPrimary = '#3b6e58';
    presetAccent = '#52796f';
    presetLightBg = '#f2f7f4';
  }

  if (typeof colorInput === 'object' && colorInput && colorInput.primary) {
    return {
      primary: colorInput.primary || presetPrimary,
      accent: colorInput.accent || presetAccent,
      darkBg: colorInput.darkBg || MOCK_STORE.themeColor.darkBg,
      lightBg: colorInput.lightBg || presetLightBg,
    };
  }

  if (typeof colorInput === 'string' && colorInput.trim().length > 0) {
    const rawColor = colorInput.trim();
    const primary = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;
    return {
      primary,
      accent: primary,
      darkBg: MOCK_STORE.themeColor.darkBg,
      lightBg: presetLightBg,
    };
  }

  return {
    primary: presetPrimary,
    accent: presetAccent,
    darkBg: MOCK_STORE.themeColor.darkBg,
    lightBg: presetLightBg,
  };
}

export async function fetchStoreConfig(slug: string): Promise<StoreConfig> {
  try {
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
      if (slug === 'onyankospa' || slug === 'onyanko-001') {
        return MOCK_ONYANKO_STORE;
      }
      return MOCK_STORE;
    }

    const templateId = data.template_id || 'luxury';

    const rInfo = data.recruit_info;
    const recruitInfo = rInfo && typeof rInfo === 'object' ? {
      title: rInfo.title,
      catchphrase: rInfo.catchphrase,
      description: rInfo.description,
      jobType: rInfo.job_type || rInfo.jobType,
      qualification: rInfo.qualification,
      salary: rInfo.salary,
      hours: rInfo.hours,
      notes: rInfo.notes,
      phone: rInfo.phone,
      lineUrl: rInfo.line_url || rInfo.lineUrl,
    } : undefined;

    const rawBanners = data.ad_banners;
    const adBanners = Array.isArray(rawBanners)
      ? rawBanners
          .filter((b: any) => b && typeof b === 'object' && b.imageUrl && b.linkUrl)
          .map((b: any) => ({ imageUrl: b.imageUrl, linkUrl: b.linkUrl, alt: b.alt || '' }))
      : undefined;

    return {
      id: data.id,
      slug: data.slug || slug,
      name: data.name || MOCK_STORE.name,
      catchphrase: data.catchphrase || MOCK_STORE.catchphrase,
      logoUrl: data.logo_url || undefined,
      templateId: templateId as any,
      themeColor: parseThemeColor(data.theme_color, templateId),
      address: data.address || MOCK_STORE.address,
      accessInfo: data.access_info || MOCK_STORE.accessInfo,
      businessHours: data.business_hours || MOCK_STORE.businessHours,
      phoneNumber: data.phone || data.phone_number || MOCK_STORE.phoneNumber,
      googleMapUrl: data.google_map_url || data.google_maps_url || MOCK_STORE.googleMapUrl,
      xUrl: data.x_url || MOCK_STORE.xUrl,
      litlinkUrl: data.litlink_url || MOCK_STORE.litlinkUrl,
      lineUrl: data.line_url || MOCK_STORE.lineUrl,
      noticeBanner: data.notice_banner || MOCK_STORE.noticeBanner,
      description: data.description || undefined,
      recruitInfo,
      termsOfService: data.terms_of_service || undefined,
      adBanners,
    };
  } catch {
    return MOCK_STORE;
  }
}

export async function fetchTherapists(shopId?: string): Promise<Therapist[]> {
  try {
    let isOnyanko = shopId === 'onyanko-001' || shopId === 'onyankospa';

    // shopIdがUUID等の場合、店舗のslugを確認して判定
    if (shopId && !isOnyanko && shopId.length > 20) {
      const { data: shopInfo } = await supabase
        .from('shops')
        .select('slug, name')
        .eq('id', shopId)
        .maybeSingle();

      if (shopInfo && (shopInfo.slug === 'onyankospa' || shopInfo.name?.includes('おニャンこ'))) {
        isOnyanko = true;
      }
    }

    let query = supabase
      .from('therapists')
      .select('*, therapist_photos(*), therapist_ranks(name)')
      .eq('is_active', true)
      .order('order', { ascending: true });

    if (shopId) {
      query = query.eq('shop_id', shopId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      if (isOnyanko) {
        return MOCK_ONYANKO_THERAPISTS;
      }
      return MOCK_THERAPISTS;
    }

    return data.map((t: any) => {
      const photos = Array.isArray(t.therapist_photos)
        ? [...t.therapist_photos].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        : [];
      
      const photoUrls = photos.length > 0
        ? photos.map((p: any) => p.photo_url)
        : (t.photo_url ? [t.photo_url] : [NO_IMAGE_THERAPIST]);

      const defaultAvatar = t.photo_url || photoUrls[0] || NO_IMAGE_THERAPIST;

      // スリーサイズ形成 (例: B85(D) W58 H88)
      const bStr = t.bust ? `B${t.bust}` : '';
      const cStr = t.bust_cup ? `(${t.bust_cup})` : '';
      const wStr = t.waist ? ` W${t.waist}` : '';
      const hStr = t.hip ? ` H${t.hip}` : '';
      const computedThreeSize = t.three_size || (bStr ? `${bStr}${cStr}${wStr}${hStr}` : undefined);

      return {
        id: t.id,
        shopId: t.shop_id,
        name: t.name,
        nameKana: t.name_kana || t.nameKana,
        age: t.age || 20,
        height: t.height || 160,
        bustCup: t.bust_cup || t.bustCup || 'C',
        bust: t.bust || undefined,
        waist: t.waist || undefined,
        hip: t.hip || undefined,
        threeSize: computedThreeSize,
        avatarUrl: defaultAvatar,
        images: photoUrls,
        badge: t.badge || undefined,
        rankName: t.therapist_ranks?.name || t.grade || undefined,
        grade: t.therapist_ranks?.name || t.grade || undefined,
        isRookie: t.is_rookie ?? false,
        tags: Array.isArray(t.tags) ? t.tags : [],
        comment: t.comment || '',
        twitterUrl: t.twitter_url || t.x_url || undefined,
        blueskyUrl: t.bluesky_url || undefined,
        lineUrl: t.line_url || undefined,
        litlinkUrl: t.litlink_url || undefined,
        isNew: t.is_new ?? t.is_rookie ?? false,
      };
    });
  } catch {
    if (shopId === 'onyanko-001' || shopId === 'onyankospa') {
      return MOCK_ONYANKO_THERAPISTS;
    }
    return MOCK_THERAPISTS;
  }
}

export async function fetchTherapistDetail(id: string): Promise<Therapist | null> {
  try {
    // おニャンこスパ専用IDの場合は即時にモックから返却
    const onyankoMatch = MOCK_ONYANKO_THERAPISTS.find((t) => t.id === id);
    if (onyankoMatch) {
      return onyankoMatch;
    }

    const { data, error } = await supabase
      .from('therapists')
      .select('*, therapist_photos(*), therapist_ranks(name)')
      .eq('id', id)
      .single();

    if (error || !data) {
      const therapists = await fetchTherapists();
      return therapists.find((t) => t.id === id) || MOCK_THERAPISTS[0];
    }

    const photos = Array.isArray(data.therapist_photos)
      ? [...data.therapist_photos].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      : [];
    
    const photoUrls = photos.length > 0
      ? photos.map((p: any) => p.photo_url)
      : [data.photo_url || data.avatar_url || NO_IMAGE_THERAPIST];

    const bStr = data.bust ? `B${data.bust}` : '';
    const cStr = data.bust_cup ? `(${data.bust_cup})` : '';
    const wStr = data.waist ? ` W${data.waist}` : '';
    const hStr = data.hip ? ` H${data.hip}` : '';
    const computedThreeSize = data.three_size || (bStr ? `${bStr}${cStr}${wStr}${hStr}` : undefined);

    // 他店舗情報の取得（同一法人・グループ内の他ショップ）
    let affiliatedShops: { id: string; name: string }[] = [];
    if (data.shop_id) {
      const { data: shopsData } = await supabase
        .from('shops')
        .select('id, name')
        .neq('id', data.shop_id)
        .eq('is_active', true)
        .limit(3);
      if (shopsData) {
        affiliatedShops = shopsData;
      }
    }

    return {
      id: data.id,
      shopId: data.shop_id,
      name: data.name,
      nameKana: data.name_kana,
      age: data.age || 20,
      height: data.height || 160,
      bustCup: data.bust_cup || 'C',
      bust: data.bust || undefined,
      waist: data.waist || undefined,
      hip: data.hip || undefined,
      threeSize: computedThreeSize,
      avatarUrl: data.photo_url || data.avatar_url || photoUrls[0] || NO_IMAGE_THERAPIST,
      images: photoUrls,
      badge: data.badge || undefined,
      rankName: data.therapist_ranks?.name || data.grade || undefined,
      grade: data.therapist_ranks?.name || data.grade || undefined,
      isRookie: data.is_rookie ?? false,
      tags: Array.isArray(data.tags) ? data.tags : [],
      comment: data.comment || '',
      twitterUrl: data.twitter_url || data.x_url || undefined,
      blueskyUrl: data.bluesky_url || undefined,
      lineUrl: data.line_url || undefined,
      litlinkUrl: data.litlink_url || undefined,
      isNew: data.is_new ?? data.is_rookie ?? false,
      affiliatedShops,
    };
  } catch {
    const onyankoMatch = MOCK_ONYANKO_THERAPISTS.find((t) => t.id === id);
    if (onyankoMatch) {
      return onyankoMatch;
    }
    const therapists = await fetchTherapists();
    return therapists.find((t) => t.id === id) || MOCK_THERAPISTS[0];
  }
}

/**
 * 登録済みシフトをリアルタイム抽出（部屋割りが未確定でも「本日出勤」等のHP表示に含める）
 */
export async function fetchConfirmedShifts(
  shopId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    let query = supabase
      .from('shifts')
      .select('*, rooms(name)')
      .eq('shop_id', shopId);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((s: any) => ({
      id: s.id,
      therapistId: s.therapist_id,
      shopId: s.shop_id,
      date: s.date,
      startTime: (s.start_time || '').slice(0, 5),
      endTime: (s.end_time || '').slice(0, 5),
      roomId: s.room_id,
      roomName: s.rooms?.name,
      notes: s.notes,
    }));
  } catch {
    return [];
  }
}

export async function fetchBlogArticles(shopId?: string, therapistId?: string): Promise<BlogArticle[]> {
  try {
    let isOnyanko = shopId === 'onyanko-001' || shopId === 'onyankospa';
    if (shopId && !isOnyanko && shopId.length > 20) {
      const { data: shopInfo } = await supabase.from('shops').select('slug, name').eq('id', shopId).maybeSingle();
      if (shopInfo && (shopInfo.slug === 'onyankospa' || shopInfo.name?.includes('おニャンこ'))) {
        isOnyanko = true;
      }
    }

    // まず therapist_blogs テーブルを検索
    let tbQuery = supabase
      .from('therapist_blogs')
      .select('*, therapists(id, name, avatar_url, photo_url)')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (shopId) {
      tbQuery = tbQuery.eq('shop_id', shopId);
    }
    if (therapistId) {
      tbQuery = tbQuery.eq('therapist_id', therapistId);
    }

    const { data: tbData } = await tbQuery;

    if (tbData && tbData.length > 0) {
      return tbData.map((b: any) => ({
        id: b.id,
        therapistId: b.therapist_id || '',
        therapistName: b.therapists?.name || 'セラピスト',
        therapistAvatar: b.therapists?.avatar_url || b.therapists?.photo_url || MOCK_THERAPISTS[0].avatarUrl,
        title: b.title,
        content: b.content,
        eyeCatchUrl: b.image_url || undefined,
        publishedAt: b.created_at
          ? new Date(b.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '最新',
        tags: Array.isArray(b.tags) ? b.tags : ['写メ日記'],
      }));
    }

    // フォールバック: blog_articles テーブルを検索
    let query = supabase
      .from('blog_articles')
      .select('*, therapists(id, name, avatar_url, photo_url)')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (shopId) {
      query = query.eq('shop_id', shopId);
    }
    if (therapistId) {
      query = query.eq('therapist_id', therapistId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      if (isOnyanko) {
        return MOCK_ONYANKO_BLOG_ARTICLES;
      }
      if (therapistId) {
        return MOCK_BLOG_ARTICLES.filter((a) => a.therapistId === therapistId);
      }
      return MOCK_BLOG_ARTICLES;
    }

    return data.map((b: any) => ({
      id: b.id,
      therapistId: b.therapist_id || '',
      therapistName: b.therapists?.name || 'セラピスト',
      therapistAvatar: b.therapists?.avatar_url || b.therapists?.photo_url || MOCK_THERAPISTS[0].avatarUrl,
      title: b.title,
      content: b.content,
      eyeCatchUrl: b.eye_catch_url || b.image_url || undefined,
      publishedAt: b.published_at ? new Date(b.published_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '最新',
      tags: Array.isArray(b.tags) ? b.tags : [],
    }));
  } catch {
    if (shopId === 'onyanko-001' || shopId === 'onyankospa') return MOCK_ONYANKO_BLOG_ARTICLES;
    return MOCK_BLOG_ARTICLES;
  }
}


export async function fetchBlogArticleDetail(id: string): Promise<BlogArticle | null> {
  const articles = await fetchBlogArticles();
  const found = articles.find((a) => a.id === id);
  if (found) return found;

  try {
    const { data, error } = await supabase
      .from('blog_articles')
      .select('*, therapists(id, name, avatar_url, photo_url)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return MOCK_BLOG_ARTICLES.find((a) => a.id === id) || MOCK_BLOG_ARTICLES[0];
    }

    return {
      id: data.id,
      therapistId: data.therapist_id || '',
      therapistName: data.therapists?.name || 'セラピスト',
      therapistAvatar: data.therapists?.avatar_url || data.therapists?.photo_url || MOCK_THERAPISTS[0].avatarUrl,
      title: data.title,
      content: data.content,
      eyeCatchUrl: data.eye_catch_url || undefined,
      publishedAt: data.published_at ? new Date(data.published_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '最新',
      tags: Array.isArray(data.tags) ? data.tags : [],
    };
  } catch {
    return MOCK_BLOG_ARTICLES.find((a) => a.id === id) || MOCK_BLOG_ARTICLES[0];
  }
}

function mapNewsRow(n: any): NewsItem {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    date: n.published_at ? n.published_at.slice(0, 10).replace(/-/g, '.') : '2026.08.01',
    category: n.category || 'お知らせ',
    imageUrl: n.image_url || undefined,
  };
}

export async function fetchNewsList(shopId?: string, limit?: number): Promise<NewsItem[]> {
  try {
    let isOnyanko = shopId === 'onyanko-001' || shopId === 'onyankospa';
    if (shopId && !isOnyanko && shopId.length > 20) {
      const { data: shopInfo } = await supabase.from('shops').select('slug, name').eq('id', shopId).maybeSingle();
      if (shopInfo && (shopInfo.slug === 'onyankospa' || shopInfo.name?.includes('おニャンこ'))) {
        isOnyanko = true;
      }
    }

    let query = supabase.from('news_items').select('*').order('published_at', { ascending: false });
    if (shopId) query = query.eq('shop_id', shopId);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    // 取得エラー（DB接続失敗など）の場合のみサンプルにフォールバックする。
    // 単に記事が0件の場合はサンプルを出さず、空配列（お知らせなし）を返す。
    if (error) {
      if (isOnyanko) return MOCK_ONYANKO_NEWS;
      return MOCK_NEWS;
    }
    if (!data || data.length === 0) {
      return [];
    }

    return data.map(mapNewsRow);
  } catch {
    if (shopId === 'onyanko-001' || shopId === 'onyankospa') return MOCK_ONYANKO_NEWS;
    return MOCK_NEWS;
  }
}

/** ニュース一覧ページ用。ページング（offsetベース）と総件数を返す。 */
export async function fetchNewsListPage(
  shopId: string,
  page: number,
  pageSize: number
): Promise<{ items: NewsItem[]; total: number }> {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('news_items')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .order('published_at', { ascending: false })
      .range(from, to);

    if (error || !data) return { items: [], total: 0 };

    return { items: data.map(mapNewsRow), total: count || 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

/** ニュース詳細ページ用。他店舗の記事を誤って表示しないよう shop_id で絞る。 */
export async function fetchNewsDetail(shopId: string, newsId: string): Promise<NewsItem | null> {
  try {
    const { data, error } = await supabase
      .from('news_items')
      .select('*')
      .eq('id', newsId)
      .eq('shop_id', shopId)
      .maybeSingle();

    if (error || !data) return null;
    return mapNewsRow(data);
  } catch {
    return null;
  }
}

export async function fetchCampaigns(shopId?: string): Promise<Campaign[]> {
  try {
    let isOnyanko = shopId === 'onyanko-001' || shopId === 'onyankospa';
    if (shopId && !isOnyanko && shopId.length > 20) {
      const { data: shopInfo } = await supabase.from('shops').select('slug, name').eq('id', shopId).maybeSingle();
      if (shopInfo && (shopInfo.slug === 'onyankospa' || shopInfo.name?.includes('おニャンこ'))) {
        isOnyanko = true;
      }
    }

    let query = supabase.from('campaigns').select('*').eq('is_active', true).order('display_order', { ascending: true });
    if (shopId) query = query.eq('shop_id', shopId);

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      if (isOnyanko) return MOCK_ONYANKO_CAMPAIGNS;
      return MOCK_CAMPAIGNS;
    }

    return data.map((c: any) => ({
      id: c.id,
      title: c.title,
      imageUrl: c.image_url,
      description: c.description || undefined,
      linkUrl: c.link_url || undefined,
      badgeText: c.badge_text || undefined,
    }));
  } catch {
    if (shopId === 'onyanko-001' || shopId === 'onyankospa') return MOCK_ONYANKO_CAMPAIGNS;
    return MOCK_CAMPAIGNS;
  }
}

export async function fetchSystemCourses(shopId?: string): Promise<SystemMenuCategory[]> {
  try {
    let isOnyanko = shopId === 'onyanko-001' || shopId === 'onyankospa';
    if (shopId && !isOnyanko && shopId.length > 20) {
      const { data: shopInfo } = await supabase.from('shops').select('slug, name').eq('id', shopId).maybeSingle();
      if (shopInfo && (shopInfo.slug === 'onyankospa' || shopInfo.name?.includes('おニャンこ'))) {
        isOnyanko = true;
      }
    }

    let query = supabase
      .from('courses')
      .select('*')
      .eq('is_active', true)
      .eq('show_on_hp', true)
      .order('display_order', { ascending: true });

    if (shopId) query = query.eq('shop_id', shopId);

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      if (isOnyanko) return MOCK_ONYANKO_SYSTEM_MENU;
      return MOCK_SYSTEM_MENU;
    }

    const categoryMap: { [catName: string]: CourseOption[] } = {};
    for (const c of data) {
      // カテゴリ名が未入力のコースは、以前のサンプルデータ由来の固定文言（例文と偶然一致し
      // 「入力していないのに表示される」と誤解を招いていた）ではなく、中立な既定名でまとめる。
      const catName = c.category_name || 'コース';
      if (!categoryMap[catName]) {
        categoryMap[catName] = [];
      }
      categoryMap[catName].push({
        id: c.id,
        name: c.name,
        durationMinutes: c.duration ?? c.duration_minutes ?? c.durationMinutes ?? 60,
        price: c.base_price ?? c.price ?? 10000,
        description: c.description || '',
      });
    }

    return Object.entries(categoryMap).map(([categoryName, courses]) => ({
      categoryName,
      courses,
    }));
  } catch {
    if (shopId === 'onyanko-001' || shopId === 'onyankospa') return MOCK_ONYANKO_SYSTEM_MENU;
    return MOCK_SYSTEM_MENU;
  }
}

/**
 * 公開HPの「システム・料金」ページに追加表示する、オプション・指名料金のカテゴリ一覧。
 * コース選択（予約フォーム等）には使わない表示専用データのため fetchSystemCourses とは分離している。
 */
export async function fetchSystemExtras(shopId?: string): Promise<SystemMenuCategory[]> {
  if (!shopId) return [];
  const categories: SystemMenuCategory[] = [];

  try {
    const { data: optionsData } = await supabase
      .from('options')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .eq('show_on_hp', true)
      .order('display_order', { ascending: true });

    if (optionsData && optionsData.length > 0) {
      categories.push({
        categoryName: 'オプション',
        courses: optionsData.map((o: any) => ({
          id: o.id,
          name: o.name,
          durationMinutes: o.duration_minutes_added || 0,
          price: o.price ?? 0,
          description: o.description || '',
        })),
      });
    }
  } catch {
    // オプション取得に失敗しても他のセクションは表示を継続する
  }

  try {
    const { data: designationData } = await supabase
      .from('designation_types')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .eq('show_on_hp', true)
      .order('display_order', { ascending: true });

    if (designationData && designationData.length > 0) {
      categories.push({
        categoryName: '指名料金',
        courses: designationData.map((d: any) => ({
          id: d.id,
          name: d.display_name,
          durationMinutes: 0,
          price: d.default_fee ?? 0,
          description: '',
        })),
      });
    }
  } catch {
    // 指名種別取得に失敗しても他のセクションは表示を継続する
  }

  return categories;
}

export interface RoomInfo {
  id: string;
  name: string;
  address?: string | null;
  googleMapUrl?: string | null;
}

// 公開HPのアクセスページ用。実際の部屋番号・詳細住所・内部メモは絶対に出さず、
// 管理画面で「HP掲載用」として明示的に入力された、あいまいな表記（public_name / address_nearby / google_map_url_nearby）のみを返す。
// public_name が未入力のルームは、防犯上デフォルトで非公開（一覧に含めない）。
export async function fetchStoreRooms(shopId: string): Promise<RoomInfo[]> {
  try {
    let targetShopId = shopId;
    if (shopId === 'onyankospa' || shopId === 'onyanko-001') {
      const { data: s } = await supabase.from('shops').select('id').eq('slug', 'onyankospa').maybeSingle();
      if (s) targetShopId = s.id;
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('id, public_name, address_nearby, google_map_url_nearby')
      .eq('shop_id', targetShopId)
      .not('public_name', 'is', null)
      .order('order', { ascending: true, nullsFirst: false });

    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      name: r.public_name,
      address: r.address_nearby,
      googleMapUrl: r.google_map_url_nearby,
    }));
  } catch {
    return [];
  }
}
