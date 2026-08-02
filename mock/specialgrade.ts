import { StoreConfig, Therapist, Campaign, BlogArticle, NewsItem, SystemMenuCategory } from '../types/store';

export const MOCK_STORE: StoreConfig = {
  id: 'sg-001',
  slug: 'specialgrade',
  name: 'SPECIAL GRADE (スペシャルグレード)',
  catchphrase: '最高品質の癒やしと極上のプライベート空間をお届けします',
  logoUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&auto=format&fit=crop&q=80',
  themeColor: {
    primary: '#e11d48',
    accent: '#f43f5e',
    darkBg: '#0b0f19',
  },
  address: '東京都北区赤羽1-XX-XX スペシャルグレードビル 3F',
  accessInfo: 'JR赤羽駅 東口より徒歩2分 / 川口駅より電車で5分',
  businessHours: '12:00 ～ 翌5:00 (最終受付 4:00)',
  phoneNumber: '03-XXXX-XXXX',
  xUrl: 'https://x.com',
  litlinkUrl: 'https://lit.link',
  noticeBanner: '🎉 新人セラピスト続々入店中！イベントキャンペーン実施中！',
};

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-1',
    title: '【期間限定】ご新規様 限定 2,000円OFFキャンペーン',
    imageUrl: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&auto=format&fit=crop&q=80',
    description: 'ご新規でご来店いただいたお客様全員に、全コース2,000円引き適応中！',
    badgeText: '新規限定',
  },
  {
    id: 'camp-2',
    title: '【深夜割】23時以降のご来店でオイル増量サービス',
    imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&auto=format&fit=crop&q=80',
    description: '深夜の疲れた身体を極上アロマオイルでじっくりケア。',
    badgeText: '深夜お得',
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
    comment: 'はじめまして！みくです✨ 心も体もぽかぽかに解きほぐせるように一生懸命施術します。お話するのも大好きです♪',
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
    comment: '日々の疲れやお悩みを忘れられるような特別なひと時をお届けします。密着アロママッサージが得意です♡',
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
    comment: '包み込むような温かいトリートメントをお約束します。疲れた時はいつでも頼ってくださいね。',
  }
];

export const MOCK_BLOG_ARTICLES: BlogArticle[] = [
  {
    id: 'blog-1',
    therapistId: 'th-1',
    therapistName: 'みく',
    therapistAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    title: '本日も出勤しています♡ 新しいオイル入荷しました！',
    content: `こんにちは！みくです✨\n\n今日はお天気が良くて気持ちいいですね♪\nお店に新しいローズ＆ラベンダーのスペシャルオイルが入荷しました！とっても良い香りなので、ぜひ体験しに来てくださいね。\n\n本日は13:00〜21:00まで出勤しています。ご予約お待ちしております♡`,
    eyeCatchUrl: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&auto=format&fit=crop&q=80',
    publishedAt: '2026-08-02 12:30',
    tags: ['出勤情報', 'オイル紹介'],
  },
  {
    id: 'blog-2',
    therapistId: 'th-2',
    therapistName: 'あおい',
    therapistAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
    title: '昨日はご指名ありがとうございました✨',
    content: `あおいです！昨日ご来店くださったN様、H様、楽しいお時間をありがとうございました！\nお二人とも肩がだいぶ凝っていたので、しっかりほぐさせていただきました😊\n\n次回もお会いできるのを楽しみにしていますね！`,
    publishedAt: '2026-08-01 19:15',
    tags: ['お礼', '日記'],
  },
];

export const MOCK_NEWS: NewsItem[] = [
  {
    id: 'news-1',
    title: '【重要】ホームページをリニューアルオープンいたしました！',
    content: 'いつもスペシャルグレードをご愛顧いただき誠にありがとうございます。この度、より使いやすく爆速で快適なWebサイトへリニューアルいたしました。',
    date: '2026-08-01',
    category: 'お知らせ',
  },
  {
    id: 'news-2',
    title: '8月限定！夏バテ解消スペシャルコース受付開始',
    content: '清涼感あふれるミントアロマを使ったリフレッシュコースを今月限定でスタートします。',
    date: '2026-07-28',
    category: 'イベント',
  },
];

export const MOCK_SYSTEM_MENU: SystemMenuCategory[] = [
  {
    categoryName: '基本リフレッシュコース',
    description: '厳選されたオイルを使用し、全身の血行を促進して疲労を根本からケアします。',
    courses: [
      { id: 'c-60', name: 'スタンダード 60分', durationMinutes: 60, price: 12000, description: 'サクッと全身を解きほぐしたい方におすすめ。' },
      { id: 'c-90', name: '人気No.1 スペシャル 90分', durationMinutes: 90, price: 16000, description: '一番人気の満足コース！気になる部分を重点ケア。' },
      { id: 'c-120', name: '極上ディープ 120分', durationMinutes: 120, price: 21000, description: '時間たっぷりの極上コース。密着ケアも存分に堪能。' },
    ],
  },
  {
    categoryName: 'プレミアムオプション',
    description: 'さらに贅沢な時間をお求めのお客様へ。',
    courses: [
      { id: 'o-oil', name: '高級CBDプレミアムオイル変更', durationMinutes: 0, price: 2000, description: '高いリラックス効果で極上の快眠へ。' },
      { id: 'o-nomination', name: 'セラピスト指名料', durationMinutes: 0, price: 2000 },
    ],
  },
];
