export interface StoreConfig {
  id: string;
  slug: string;
  name: string;
  catchphrase: string;
  logoUrl?: string;
  themeColor: {
    primary: string; // e.g. '#e11d48'
    accent: string;  // e.g. '#f43f5e'
    darkBg: string;  // e.g. '#0f172a'
  };
  address: string;
  accessInfo: string;
  businessHours: string;
  phoneNumber: string;
  xUrl?: string;
  litlinkUrl?: string;
  lineUrl?: string;
  noticeBanner?: string;
}

export interface Therapist {
  id: string;
  name: string;
  nameKana?: string;
  age: number;
  height: number;
  bustCup: string;
  threeSize?: string; // B88(F) W58 H86
  avatarUrl: string;
  images: string[];
  badge?: string;     // e.g. 'NEW', '新人', 'PICKUP'
  grade?: string;     // e.g. 'トップセラピスト', 'レギュラー'
  tags: string[];     // e.g. ['癒し系', 'モデル体型', '密着マッサージ', '愛嬌抜群']
  comment: string;
  twitterUrl?: string;
  litlinkUrl?: string;
  isNew?: boolean;
}

export interface ScheduleSlot {
  time: string;       // e.g. '12:00 ~ 20:00'
  status: 'available' | 'few' | 'busy' | 'finished';
}

export interface TherapistSchedule {
  therapistId: string;
  date: string;       // YYYY-MM-DD
  slots: ScheduleSlot[];
  isTodayWork?: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  imageUrl: string;
  description?: string;
  linkUrl?: string;
  badgeText?: string;
}

export interface BlogArticle {
  id: string;
  therapistId: string;
  therapistName: string;
  therapistAvatar: string;
  title: string;
  content: string;
  eyeCatchUrl?: string;
  publishedAt: string;
  tags?: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  category?: string;
}

export interface CourseOption {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  description?: string;
}

export interface SystemMenuCategory {
  categoryName: string;
  description?: string;
  courses: CourseOption[];
}
