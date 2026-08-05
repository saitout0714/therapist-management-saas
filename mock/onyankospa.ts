import { StoreConfig, Therapist, Campaign, BlogArticle, NewsItem, SystemMenuCategory } from '../types/store';

export const MOCK_ONYANKO_STORE: StoreConfig = {
  id: 'onyanko-001',
  slug: 'onyankospa',
  name: 'おニャンこスパ',
  catchphrase: '〜サイバーネオンと極上密着空間〜 メンズエステ',
  logoUrl: '/images/onyanko_mainvisual.jpg',
  themeColor: {
    primary: '#ff007f',  // サイバーネオンピンク
    accent: '#ff2a8d',   // ビビッドピンク
    darkBg: '#050014',   // ディープナイトパープル
    lightBg: '#1a0933',  // ナイトパープル
  },
  address: '東京都新宿区歌舞伎町 / 渋谷区道玄坂',
  accessInfo: '新宿駅東口徒歩3分・渋谷駅ハチ公口徒歩4分',
  businessHours: 'OPEN/11:00～5:00 (受付/10:30〜3:30)',
  phoneNumber: '070-7431-3060',
  xUrl: 'https://x.com',
  litlinkUrl: 'https://lit.link',
  lineUrl: 'https://line.me',
  noticeBanner: '🐾 おニャンこスパ グランドオープン！新規ご来店で¥2,000 OFFキャンペーン開催中 🐾',
  templateId: 'cute',
  layoutSections: ['hero', 'today_shifts', 'therapists', 'diary', 'system', 'news', 'access'],
};

export const MOCK_ONYANKO_CAMPAIGNS: Campaign[] = [
  {
    id: 'onyanko-camp-1',
    title: 'おニャンこスパ〜サイバーネオン密着アロマ〜 GRAND OPEN',
    imageUrl: '/images/onyanko_mainvisual.jpg',
    description: '可愛い猫耳セラピストが贈る、極上の癒やしリラクゼーション体験！',
    badgeText: '祝・OPEN',
  },
  {
    id: 'onyanko-camp-2',
    title: '初回ご来店限定！ご新規様★特別割 ¥2,000-OFF',
    imageUrl: '/images/onyanko_mainvisual.jpg',
    description: '「HPを見た」とお伝えで、すべてのコースから¥2,000引き適応中♪',
    badgeText: 'ご新規様割',
  },
  {
    id: 'onyanko-camp-3',
    title: 'WEB予約で24時間いつでも簡単予約',
    imageUrl: '/images/onyanko_mainvisual.jpg',
    description: 'セラピストの空き時間や出勤スケジュールをオンラインでいつでもチェック＆予約OK！',
    badgeText: '24H予約',
  },
];

export const MOCK_ONYANKO_THERAPISTS: Therapist[] = [
  {
    id: 'onyanko-th-1',
    name: 'にゃん',
    nameKana: 'ニャン',
    age: 21,
    height: 158,
    bustCup: 'E',
    threeSize: 'B85(E) W57 H86',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
    ],
    badge: '看板猫',
    grade: 'エースセラピスト',
    tags: ['小悪魔系', '猫耳デレ', 'モチモチ肌', '密着アロマ'],
    comment: 'にゃ〜んっ🐾 お仕事でお疲れの貴方を、温かいオイルと密着マッサージで包み込みます♡',
    twitterUrl: 'https://x.com',
    litlinkUrl: 'https://lit.link',
    isNew: true,
  },
  {
    id: 'onyanko-th-2',
    name: 'ここ',
    nameKana: 'ココ',
    age: 23,
    height: 163,
    bustCup: 'F',
    threeSize: 'B88(F) W58 H87',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
    ],
    badge: 'NEW',
    grade: '注目新人',
    tags: ['癒し系', 'モデルスタイル', '愛嬌満点', '密着極上'],
    comment: 'はじめまして、ここです！お互いの温もりを感じながら最高のリラクゼーションを…♪',
    twitterUrl: 'https://x.com',
    isNew: true,
  },
  {
    id: 'onyanko-th-3',
    name: 'るな',
    nameKana: 'ルナ',
    age: 22,
    height: 160,
    bustCup: 'D',
    threeSize: 'B84(D) W56 H85',
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
    ],
    badge: '人気',
    grade: 'トップセラピスト',
    tags: ['ツンデレ猫', '美肌施術', 'リピート率No1'],
    comment: '甘いひとときを過ごしにきてね♡丁寧にほぐしてあげる♪',
    twitterUrl: 'https://x.com',
  },
];

export const MOCK_ONYANKO_BLOG_ARTICLES: BlogArticle[] = [
  {
    id: 'onyanko-blog-1',
    therapistId: 'onyanko-th-1',
    therapistName: 'にゃん',
    therapistAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    title: '本日出勤してますっ🐾 一緒にまったりしよ？',
    content: '今日もお天気がいいですね！新しく届いたピンクアロマオイルで、皆様を癒やしちゃいます♡ お部屋暖かくしてお待ちしてます！',
    publishedAt: '2026-08-05 11:30',
  },
];

export const MOCK_ONYANKO_NEWS: NewsItem[] = [
  {
    id: 'onyanko-news-1',
    title: '【Grand Open】メンズエステ「おニャンこスパ」オープン！',
    content: '完全プライベート個室のおニャンこスパが新規オープンいたしました。皆様のご来店をセラピスト一同心よりお待ちしております。',
    date: '2026.08.05',
    category: 'お知らせ',
  },
  {
    id: 'onyanko-news-2',
    title: '24時間ネット予約に対応いたしました',
    content: '公式HPより24時間いつでも出勤スケジュール確認・リアルタイム予約が可能になりました。',
    date: '2026.08.05',
    category: 'システム',
  },
];

export const MOCK_ONYANKO_SYSTEM_MENU: SystemMenuCategory[] = [
  {
    categoryName: 'Standard Onyanko Aroma (スタンダードアロマ)',
    description: '最高級の天然無添加オイルと密着マッサージで、全身の疲れを優しくケア。',
    courses: [
      { id: 'c1', name: '70分 お試しニャンこコース', price: 13000, durationMinutes: 70, description: '初めてのお客様やサクッと癒やされたい方に' },
      { id: 'c2', name: '90分 定番おニャンこ贅沢コース', price: 16000, durationMinutes: 90, description: '一番人気の定番！全身をじっくりほぐします' },
      { id: 'c3', name: '120分 極上とろけるロングコース', price: 21000, durationMinutes: 120, description: '存分に密着と癒やしを満を満喫したい貴方に' },
    ],
  },
  {
    categoryName: 'Special Premium Option (オプション)',
    description: 'お好みのおもてなしを追加できます。',
    courses: [
      { id: 'o1', name: '密着ディープエステ', price: 3000, durationMinutes: 0 },
      { id: 'o2', name: '温感スパオイル変更', price: 2000, durationMinutes: 0 },
    ],
  },
];
