const dbNames = [
  "七緒なお", "夢乃ゆり", "古川えり", "宮本明歩", "横峯ゆずは",
  "北川ゆい", "柚木いちか", "愛川詩乃", "南 瑠夏", "香坂芽依",
  "松下櫻子", "藍田茉莉", "堀内咲良", "永瀬なぎ", "秋吉カンナ",
  "結城はるか", "星乃ひかり", "桧山ひな", "桐澤ひとみ", "真田ありさ",
  "小宮山りな", "森内みお", "深田雪乃", "上野みき", "清水あおい",
  "笛木さな", "石原ゆあ", "奥山奈美", "松岡はな", "雨森みか",
  "暁美ほむら", "一ノ瀬れい", "黒木ノア"
];

const scraped = [
  { name: "七緒なお", profile_url: "https://carezza.esthe-hp.com/item_10024583.html" },
  { name: "夢乃ゆり", profile_url: "https://carezza.esthe-hp.com/item_10026210.html" },
  { name: "結城はるか", profile_url: "https://carezza.esthe-hp.com/item_10028836.html" },
  { name: "桐澤ひとみ", profile_url: "https://carezza.esthe-hp.com/item_10016378.html" },
  { name: "愛川詩乃", profile_url: "https://carezza.esthe-hp.com/item_10038893.html" },
  { name: "秋吉カンナ", profile_url: "https://carezza.esthe-hp.com/item_10032626.html" },
  { name: "櫻井あき", profile_url: "https://carezza.esthe-hp.com/item_10029087.html" },
  { name: "桧山ひな", profile_url: "https://carezza.esthe-hp.com/item_10030373.html" },
  { name: "古川えり", profile_url: "https://carezza.esthe-hp.com/item_10033965.html" },
  { name: "柚木いちか", profile_url: "https://carezza.esthe-hp.com/item_10026277.html" },
  { name: "竹下 幸", profile_url: "https://carezza.esthe-hp.com/item_10039123.html" },
  { name: "松下櫻子", profile_url: "https://carezza.esthe-hp.com/item_10038611.html" },
  { name: "藍田茉莉", profile_url: "https://carezza.esthe-hp.com/item_10037742.html" },
  { name: "香坂芽依", profile_url: "https://carezza.esthe-hp.com/item_10038145.html" },
  { name: "森内みお", profile_url: "https://carezza.esthe-hp.com/item_10032342.html" },
  { name: "真田ありさ", profile_url: "https://carezza.esthe-hp.com/item_10028320.html" },
  { name: "上野みき", profile_url: "https://carezza.esthe-hp.com/item_10029741.html" },
  { name: "横峯ゆずは", profile_url: "https://carezza.esthe-hp.com/item_10022588.html" },
  { name: "北川ゆい", profile_url: "https://carezza.esthe-hp.com/item_10036023.html" },
  { name: "清水あおい", profile_url: "https://carezza.esthe-hp.com/item_10030567.html" },
  { name: "宮本明歩", profile_url: "https://carezza.esthe-hp.com/item_10038516.html" },
  { name: "堀内咲良", profile_url: "https://carezza.esthe-hp.com/item_10038561.html" },
  { name: "永瀬なぎ", profile_url: "https://carezza.esthe-hp.com/item_10031667.html" },
  { name: "星乃ひかり", profile_url: "https://carezza.esthe-hp.com/item_10016422.html" },
  { name: "深田雪乃", profile_url: "https://carezza.esthe-hp.com/item_10033974.html" },
  { name: "笛木さな", profile_url: "https://carezza.esthe-hp.com/item_10037279.html" },
  { name: "石原ゆあ", profile_url: "https://carezza.esthe-hp.com/item_10036265.html" },
  { name: "小宮山りな", profile_url: "https://carezza.esthe-hp.com/item_10034875.html" },
  { name: "奥山奈美", profile_url: "https://carezza.esthe-hp.com/item_10037299.html" },
  { name: "雨森みか", profile_url: "https://carezza.esthe-hp.com/item_10026931.html" },
  { name: "一ノ瀬れい", profile_url: "https://carezza.esthe-hp.com/item_10016573.html" }
];

const normalizeName = (s) => s.trim().toLowerCase().replace(/\s+/g, '').replace(/　/g, '');

const result = dbNames.map(name => {
  const en = normalizeName(name);
  const match = scraped.find(s => {
    const sn = normalizeName(s.name);
    return sn === en || sn.includes(en) || en.includes(sn);
  });
  return {
    name,
    matchedUrl: match?.profile_url || null,
    matchedName: match?.name || null
  };
});

console.log(JSON.stringify(result, null, 2));
