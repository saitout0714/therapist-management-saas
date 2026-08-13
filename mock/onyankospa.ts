import { StoreConfig, Therapist, Campaign, BlogArticle, NewsItem, SystemMenuCategory } from '../types/store';

export const MOCK_ONYANKO_STORE: StoreConfig = {
  id: 'onyanko-001',
  slug: 'onyankospa',
  name: 'おニャンこスパ',
  catchphrase: '〜サイバーネオンと極上密着空間〜 メンズエステ',
  logoUrl: undefined,
  themeColor: {
    primary: '#ff6fb5',  // サイバーネオンピンク
    accent: '#ffa8d8',   // ビビッドピンク
    darkBg: '#0b0813',   // ディープナイトパープル
    lightBg: '#120e24',  // ナイトパープル
  },
  address: '東京都豊島区南大塚2丁目33-6 ライトハウス',
  accessInfo: '東京都豊島区南大塚2丁目33-6 ライトハウス',
  businessHours: '11:00〜28:00 (受付 10:00〜26:00)',
  phoneNumber: '090-0000-0000',
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
    title: 'おニャンこスパ GRAND OPEN 記念★新規来店 ¥2,000 OFF',
    imageUrl: '/images/events/onyanko_event1.jpg',
    description: '「HPを見た」とお伝えで全コースから¥2,000引き中！極上密着リラクゼーションを是非体感ください♪',
    badgeText: '祝・OPEN割',
  },
  {
    id: 'onyanko-camp-2',
    title: '24時間 リアルタイムWEB予約スタート！',
    imageUrl: '/images/events/onyanko_event2_blue.jpg',
    description: 'セラピストの出勤スケジュール確認から指名予約まで、オンラインでいつでも即時完了OK！',
    badgeText: '24H予約対応',
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
    avatarUrl: '/images/therapists/onyanko_th_1.jpg',
    images: [
      '/images/therapists/onyanko_th_1.jpg',
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
    avatarUrl: '/images/therapists/onyanko_th_2.jpg',
    images: [
      '/images/therapists/onyanko_th_2.jpg',
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
    avatarUrl: '/images/therapists/onyanko_th_3.jpg',
    images: [
      '/images/therapists/onyanko_th_3.jpg',
    ],
    badge: '人気',
    grade: 'トップセラピスト',
    tags: ['ツンデレ猫', '美肌施術', 'リピート率No1'],
    comment: '甘いひとときを過ごしにきてね♡丁寧にほぐしてあげる♪',
    twitterUrl: 'https://x.com',
  },
  {
    id: 'onyanko-th-4',
    name: 'たま',
    nameKana: 'タマ',
    age: 20,
    height: 156,
    bustCup: 'C',
    threeSize: 'B83(C) W55 H84',
    avatarUrl: '/images/therapists/onyanko_th_4.jpg',
    images: [
      '/images/therapists/onyanko_th_4.jpg',
    ],
    badge: '新人',
    grade: 'ピュアセラピスト',
    tags: ['天然系', '密着アロマ', '癒やしボイス'],
    comment: '一生懸命頑張ります！癒やされに来てくださいね🐾',
    twitterUrl: 'https://x.com',
    isNew: true,
  },
];

export const MOCK_ONYANKO_BLOG_ARTICLES: BlogArticle[] = [
  {
    id: 'onyanko-blog-1',
    therapistId: 'onyanko-th-1',
    therapistName: 'にゃん',
    therapistAvatar: '/images/therapists/onyanko_th_1.jpg',
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
      { id: 'c1', name: '80分コース', price: 16000, durationMinutes: 80, description: '80分 16,000円' },
      { id: 'c2', name: '100分コース', price: 20000, durationMinutes: 100, description: '100分 20,000円' },
      { id: 'c3', name: '120分コース', price: 24000, durationMinutes: 120, description: '120分 24,000円' },
    ],
  },
  {
    categoryName: 'Special Premium Option & Nomination (オプション・指名料)',
    description: '延長・オプション・指名料金のご案内。',
    courses: [
      { id: 'o1', name: '延長 (30分)', price: 7000, durationMinutes: 30 },
      { id: 'o2', name: '各種オプション', price: 1000, durationMinutes: 0, description: 'オプション1,000円〜' },
      { id: 'd1', name: '写真指名', price: 1000, durationMinutes: 0 },
      { id: 'd2', name: '姫予約・本指名', price: 2000, durationMinutes: 0, description: '2,000円〜' },
    ],
  },
];
