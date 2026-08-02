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
  StoreConfig,
  Therapist,
  Campaign,
  BlogArticle,
  NewsItem,
  SystemMenuCategory,
} from '../types/store';

export async function fetchStoreConfig(slug: string): Promise<StoreConfig> {
  try {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      return MOCK_STORE;
    }

    return {
      id: data.id,
      slug: data.slug || slug,
      name: data.name || MOCK_STORE.name,
      catchphrase: data.catchphrase || MOCK_STORE.catchphrase,
      logoUrl: data.logo_url || MOCK_STORE.logoUrl,
      themeColor: data.theme_color || MOCK_STORE.themeColor,
      address: data.address || MOCK_STORE.address,
      accessInfo: data.access_info || MOCK_STORE.accessInfo,
      businessHours: data.business_hours || MOCK_STORE.businessHours,
      phoneNumber: data.phone || data.phone_number || MOCK_STORE.phoneNumber,
      xUrl: data.x_url || MOCK_STORE.xUrl,
      litlinkUrl: data.litlink_url || MOCK_STORE.litlinkUrl,
      lineUrl: data.line_url || MOCK_STORE.lineUrl,
      noticeBanner: data.notice_banner || MOCK_STORE.noticeBanner,
    };
  } catch {
    return MOCK_STORE;
  }
}

export async function fetchTherapists(shopId?: string): Promise<Therapist[]> {
  try {
    let query = supabase
      .from('therapists')
      .select('*, therapist_photos(*)')
      .eq('is_active', true);

    if (shopId) {
      query = query.eq('shop_id', shopId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return MOCK_THERAPISTS;
    }

    return data.map((t: any) => ({
      id: t.id,
      name: t.name,
      nameKana: t.name_kana || t.nameKana,
      age: t.age || 20,
      height: t.height || 160,
      bustCup: t.bust_cup || t.bustCup || 'C',
      threeSize: t.three_size || (t.bust ? `B${t.bust} W${t.waist || ''} H${t.hip || ''}` : undefined),
      avatarUrl: t.avatar_url || t.photo_url || MOCK_THERAPISTS[0].avatarUrl,
      images: Array.isArray(t.therapist_photos) && t.therapist_photos.length > 0
        ? t.therapist_photos.map((p: any) => p.photo_url)
        : [t.photo_url || t.avatar_url || MOCK_THERAPISTS[0].avatarUrl],
      badge: t.badge || undefined,
      grade: t.grade || undefined,
      tags: Array.isArray(t.tags) && t.tags.length > 0 ? t.tags : ['癒し系'],
      comment: t.comment || '',
      twitterUrl: t.twitter_url || t.x_url || undefined,
      litlinkUrl: t.litlink_url || undefined,
      isNew: t.is_new ?? false,
    }));
  } catch {
    return MOCK_THERAPISTS;
  }
}

export async function fetchTherapistDetail(id: string): Promise<Therapist | null> {
  const therapists = await fetchTherapists();
  const found = therapists.find((t) => t.id === id);
  if (found) return found;

  try {
    const { data, error } = await supabase
      .from('therapists')
      .select('*, therapist_photos(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return MOCK_THERAPISTS.find((t) => t.id === id) || MOCK_THERAPISTS[0];
    }

    return {
      id: data.id,
      name: data.name,
      nameKana: data.name_kana,
      age: data.age || 20,
      height: data.height || 160,
      bustCup: data.bust_cup || 'C',
      threeSize: data.three_size,
      avatarUrl: data.avatar_url || data.photo_url || MOCK_THERAPISTS[0].avatarUrl,
      images: Array.isArray(data.therapist_photos) && data.therapist_photos.length > 0
        ? data.therapist_photos.map((p: any) => p.photo_url)
        : [data.photo_url || data.avatar_url || MOCK_THERAPISTS[0].avatarUrl],
      badge: data.badge || undefined,
      grade: data.grade || undefined,
      tags: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : ['癒し系'],
      comment: data.comment || '',
      twitterUrl: data.twitter_url || data.x_url || undefined,
      litlinkUrl: data.litlink_url || undefined,
      isNew: data.is_new ?? false,
    };
  } catch {
    return MOCK_THERAPISTS.find((t) => t.id === id) || MOCK_THERAPISTS[0];
  }
}

export async function fetchBlogArticles(shopId?: string, therapistId?: string): Promise<BlogArticle[]> {
  try {
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
      eyeCatchUrl: b.eye_catch_url || undefined,
      publishedAt: b.published_at ? new Date(b.published_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '最新',
      tags: Array.isArray(b.tags) ? b.tags : [],
    }));
  } catch {
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

export async function fetchNewsList(shopId?: string): Promise<NewsItem[]> {
  try {
    let query = supabase.from('news_items').select('*').order('published_at', { ascending: false });
    if (shopId) query = query.eq('shop_id', shopId);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return MOCK_NEWS;

    return data.map((n: any) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      date: n.published_at ? n.published_at.slice(0, 10).replace(/-/g, '.') : '2026.08.01',
      category: n.category || 'お知らせ',
    }));
  } catch {
    return MOCK_NEWS;
  }
}

export async function fetchCampaigns(shopId?: string): Promise<Campaign[]> {
  try {
    let query = supabase.from('campaigns').select('*').eq('is_active', true).order('display_order', { ascending: true });
    if (shopId) query = query.eq('shop_id', shopId);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return MOCK_CAMPAIGNS;

    return data.map((c: any) => ({
      id: c.id,
      title: c.title,
      imageUrl: c.image_url,
      description: c.description || undefined,
      linkUrl: c.link_url || undefined,
      badgeText: c.badge_text || undefined,
    }));
  } catch {
    return MOCK_CAMPAIGNS;
  }
}

export async function fetchSystemCourses(shopId?: string): Promise<SystemMenuCategory[]> {
  try {
    let query = supabase.from('courses').select('*');
    if (shopId) query = query.eq('shop_id', shopId);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return MOCK_SYSTEM_MENU;

    const courses = data.map((c: any) => ({
      id: c.id,
      name: c.name,
      durationMinutes: c.duration_minutes || c.durationMinutes || 60,
      price: c.price || 10000,
      description: c.description || '',
    }));

    return [
      {
        categoryName: '基本リフレッシュコース',
        description: '厳選されたオイルを使用し、全身の血行を促進して疲労を根本からケアします。',
        courses,
      },
    ];
  } catch {
    return MOCK_SYSTEM_MENU;
  }
}
