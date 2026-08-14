import { StoreConfig, Therapist, Campaign, BlogArticle, NewsItem, SystemMenuCategory } from '../types/store';

export const MOCK_STORE: StoreConfig = {
  id: 'sg-001',
  slug: 'specialgrade',
  name: 'Special Grade',
  catchphrase: '赤羽・川口 メンズエステ ～上質で優雅な至福の空間～',
  logoUrl: undefined,
  themeColor: {
    primary: '#d1b464',
    accent: '#a39573',
    darkBg: '#464646',
    lightBg: '#faf7f0',
  },
  address: '東京都北区赤羽 / 埼玉県川口市',
  accessInfo: '赤羽駅徒歩2分・川口駅徒歩3分',
  businessHours: 'OPEN/11:00～5:00 (受付/10:30〜2:00)',
  phoneNumber: '070-1462-0389',
  xUrl: 'https://x.com',
  litlinkUrl: 'https://lit.link',
  noticeBanner: '✨ 赤羽・川口エリアで選ばれ続ける最高級メンズエステ ✨',
  layoutSections: ['hero', 'today_shifts', 'therapists', 'diary', 'news', 'system', 'access'],
};

// DB取得が完了するまでの初期表示用。文言・連絡先などの「編集され得る内容」は空にし、
// 他店舗（Special Gradeの店名・電話番号など）のサンプル文言が一瞬表示されるのを防ぐ。
export const BLANK_STORE: StoreConfig = {
  id: '',
  slug: '',
  name: '',
  catchphrase: '',
  logoUrl: undefined,
  themeColor: MOCK_STORE.themeColor,
  address: '',
  accessInfo: '',
  businessHours: '',
  phoneNumber: '',
  layoutSections: MOCK_STORE.layoutSections,
};

// 本物のSpecial Gradeオリジナルイベントバナー画像セット
export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-1',
    title: 'Special Grade - ONLY ONE RELAXATION PLACE',
    imageUrl: '/images/banners/top0023.jpg',
    description: 'Thank you for choosing us from the many men\'s esthe. Don\'t think feel!',
    badgeText: '公式',
  },
  {
    id: 'camp-2',
    title: '当店ご利用初めてのお客様 はじめまして割 ¥1,000-off',
    imageUrl: '/images/banners/新人割引1000.jpg',
    description: '初回ご来店のお客様限定！受付時申告で¥1,000引き適応。',
    badgeText: '初回限定',
  },
  {
    id: 'camp-3',
    title: 'WEB予約 新しく便利になりました',
    imageUrl: '/images/banners/systembanner.jpg',
    description: 'PCでもスマホでも24時間いつでも簡単ネット予約。',
    badgeText: '便利',
  },
  {
    id: 'camp-4',
    title: 'LINE公式アカウント 友だち募集中',
    imageUrl: '/images/banners/top0002.jpg',
    description: 'お得なクーポンや出勤情報をLINEで配信中！',
    badgeText: 'LINE',
  },
  {
    id: 'camp-5',
    title: 'Special Grade - 極上のリラクゼーション',
    imageUrl: '/images/banners/top0001.jpg',
    description: '技術・ルックス・心遣いの三点を厳選したセラピストたち。',
    badgeText: '厳選',
  },
];

export const MOCK_THERAPISTS: Therapist[] = [
  {
    id: 'th-1',
    name: 'みく',
    nameKana: 'ミク',
    age: 21,
    height: 162,
    bustCup: 'E',
    threeSize: 'B86(E) W58 H87',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
    ],
    badge: 'NEW',
    grade: '注目新人',
    tags: ['スレンダー', '癒し系', '愛嬌抜群', '密着施術'],
    comment: 'はじめまして！みくです✨ 心も体もぽかぽかに解きほぐせるように一生懸命施術します。',
    twitterUrl: 'https://x.com',
    litlinkUrl: 'https://lit.link',
    isNew: true,
  },
  {
    id: 'th-2',
    name: 'あおい',
    nameKana: 'アオイ',
    age: 24,
    height: 166,
    bustCup: 'F',
    threeSize: 'B89(F) W59 H88',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
    ],
    grade: 'トップセラピスト',
    tags: ['モデル体型', '美人系', '本格密着', 'リピート率No1'],
    comment: '日々の疲れやお悩みを忘れられるような特別なひと時をお届けします。',
    twitterUrl: 'https://x.com',
  },
  {
    id: 'th-3',
    name: 'りな',
    nameKana: 'リナ',
    age: 22,
    height: 158,
    bustCup: 'D',
    threeSize: 'B84(D) W57 H85',
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
    ],
    badge: 'PICKUP',
    grade: '人気急上昇',
    tags: ['小柄可愛い', '聞き上手', 'モチモチ肌', '癒やしボイス'],
    comment: 'お客様の笑顔が私の元気の源です♪ ゆっくりリラックスしていってくださいね！',
    twitterUrl: 'https://x.com',
  },
  {
    id: 'th-4',
    name: 'ほのか',
    nameKana: 'ホノカ',
    age: 23,
    height: 160,
    bustCup: 'E',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80',
    images: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80'],
    tags: ['お姉さん系', '包容力', '密着技術', '丁寧な施術'],
    comment: '包み込むような温かいトリートメントをお約束します。',
  }
];

export const MOCK_BLOG_ARTICLES: BlogArticle[] = [
  {
    id: 'blog-1',
    therapistId: 'th-1',
    therapistName: 'みく',
    therapistAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    title: '本日も出勤しています♡ 新しいオイル入荷しました！',
    content: `こんにちは！みくです✨\n\n今日はお天気が良くて気持ちいいですね♪\nお店に新しいローズ＆ラベンダーのスペシャルオイルが入荷しました！`,
    eyeCatchUrl: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&auto=format&fit=crop&q=80',
    publishedAt: '8/2 12:30',
    tags: ['出勤情報', 'オイル紹介'],
  },
  {
    id: 'blog-2',
    therapistId: 'th-2',
    therapistName: 'あおい',
    therapistAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
    title: '昨日はご指名ありがとうございました✨',
    content: `あおいです！昨日ご来店くださったお客様、楽しいお時間をありがとうございました！`,
    publishedAt: '8/1 19:15',
    tags: ['お礼', '日記'],
  },
];

export const MOCK_NEWS: NewsItem[] = [
  {
    id: 'news-1',
    title: '【重要】ホームページをリニューアルオープンいたしました！',
    content: 'いつもスペシャルグレードをご愛顧いただき誠にありがとうございます。より綺麗で見やすい公式Webサイトへリニューアルいたしました。',
    date: '2026.08.01',
    category: 'お知らせ',
  },
  {
    id: 'news-2',
    title: 'ホットオイルコース好評実施中',
    content: '温もりとともに深いリラクゼーションをもたらす人気コースです。',
    date: '2026.07.28',
    category: 'イベント',
  },
];

export const MOCK_SYSTEM_MENU: SystemMenuCategory[] = [
  {
    categoryName: '基本リフレッシュコース',
    description: '厳選されたオイルを使用し、全身の血行を促進して疲労を根本からケアします。',
    courses: [
      { id: 'c-60', name: 'スタンダード 60分', durationMinutes: 60, price: 12000, description: 'サクッと全身を解きほぐしたい方におすすめ。' },
      { id: 'c-90', name: '人気No.1 スペシャル 90分', durationMinutes: 90, price: 16000, description: '一番人気の満足コース！' },
      { id: 'c-120', name: '極上ディープ 120分', durationMinutes: 120, price: 21000, description: '時間たっぷりの極上コース。' },
    ],
  },
];
