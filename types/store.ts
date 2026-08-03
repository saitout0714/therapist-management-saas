export interface StoreConfig {
  id: string;
  slug: string;
  name: string;
  catchphrase: string;
  logoUrl?: string;
  themeColor: {
    primary: string; // e.g. '#d1b464' (Gold)
    accent: string;  // e.g. '#a39573' (Champagne)
    darkBg: string;  // e.g. '#464646' (Chic Dark)
    lightBg: string; // e.g. '#faf7f0' (Beige Light)
  };
  address: string;
  accessInfo: string;
  businessHours: string;
  phoneNumber: string;
  googleMapUrl?: string;
  xUrl?: string;
  litlinkUrl?: string;
  lineUrl?: string;
  noticeBanner?: string;
}

export interface Therapist {
  id: string;
  shopId?: string;
  name: string;
  nameKana?: string;
  age: number;
  height: number;
  bustCup: string;
  bust?: number;
  waist?: number;
  hip?: number;
  threeSize?: string; // B86(E) W58 H87
  avatarUrl: string;
  images: string[];
  badge?: string;     // e.g. 'NEW', '新人', 'PICKUP'
  rankName?: string;  // e.g. 'トップ', '高級', '指名多数'
  grade?: string;     // e.g. 'トップセラピスト', 'レギュラー'
  isRookie?: boolean; // 新人フラグ
  tags: string[];     // e.g. ['癒し系', 'モデル体型', '密着マッサージ', '愛嬌抜群']
  comment?: string;   // 自己PR文
  twitterUrl?: string;
  litlinkUrl?: string;
  isNew?: boolean;
  affiliatedShops?: { id: string; name: string }[]; // 他店舗連携情報
}

export interface ConfirmedShift {
  id: string;
  therapistId: string;
  shopId: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  roomId: string;     // 部屋割り確定済みID
  roomName?: string;
  notes?: string;
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
  shift?: ConfirmedShift;
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
