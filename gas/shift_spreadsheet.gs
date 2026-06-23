// =============================================
// クリスタルシフト・時間順ソート & 2026年強制補正版
// テキスト入力専用（クイーンテラス・レジェンド対応）
// レジェンド特殊並び替え版（武蔵浦和全体を左、その他を右）
// =============================================

const SPREADSHEET_ID = '1ClCKIiPotK9iPgkraz6BcfRsGj5huD9GG0TpSe_zkJk';

const SHOP_CONFIG = {
  "shop_1": {
    "name": "SPA RICH",
    "sheetName": "SPA RICH",
    "supabaseShopId": "a0000001-0000-0000-0000-000000000001",
    "rooms": {
      "1": {
        "name": "王子ルーム",
        "color": "#00FFFF"
      },
      "2": {
        "name": "板橋ルーム",
        "color": "#FFFF00"
      }
    },
    "staffList": [
      "みさと",
      "みさき",
      "すずか",
      "ありさ",
      "なごみ",
      "みずの",
      "はな",
      "ひかる",
      "ゆめ",
      "あおい",
      "うみ",
      "せな",
      "ゆきの"
    ]
  },
  "shop_2": {
    "name": "こころリンス大山",
    "sheetName": "大山",
    "supabaseShopId": "a0000001-0000-0000-0000-000000000004",
    "rooms": {
      "1": {
        "name": "ロアール506",
        "color": "#00FFFF"
      },
      "2": {
        "name": "ロアール604",
        "color": "#FFFF00"
      }
    },
    "staffList": [
      "あいうち",
      "あおい",
      "あき",
      "あさの",
      "あまみや",
      "あやせ",
      "あやの",
      "あゆかわ",
      "かすが",
      "かねしろ",
      "きたがわ",
      "きょうもと",
      "さくら",
      "たかはし",
      "ななお",
      "はなざわ",
      "はなやま",
      "ふじさき",
      "みずの",
      "みづき",
      "みなせ",
      "もりた"
    ]
  },
  "shop_3": {
    "name": "こころリンス浅草橋",
    "sheetName": "ﾘﾝｽ",
    "supabaseShopId": "dc3caa06-fcc2-4bdc-b063-7969296efd34",
    "rooms": {
      "1": {
        "name": "浅草橋201(浅A）",
        "color": "#00FF00"
      },
      "2": {
        "name": "柳橋401(浅Ｃ)",
        "color": "#FF9900"
      },
      "3": {
        "name": "馬喰町302",
        "color": "#FFFF00"
      },
      "4": {
        "name": "柳橋502(浅B）",
        "color": "#00FFFF"
      }
    },
    "staffList": [
      "あいうち",
      "あいざわ",
      "あいだ",
      "あおい",
      "あさひな",
      "あべ",
      "あやせ",
      "あゆかわ",
      "いいじま",
      "いけだ",
      "いずみ",
      "ももの",
      "おおしろ",
      "おおたに",
      "かの",
      "かゆき",
      "かんだ",
      "くるみ",
      "さくらい",
      "ささき",
      "さわだ",
      "しまだ",
      "しらとり",
      "すぎうら",
      "せりざわ",
      "たかき",
      "つばき",
      "はなざわ",
      "ひいらぎ",
      "ひろさき",
      "ふじさき",
      "ふぶき",
      "ふゆつき",
      "ほしの",
      "ほんだ",
      "まき",
      "まつおか",
      "まつだ",
      "まるやま",
      "みなみ",
      "ももい",
      "もりた",
      "ゆきの",
      "ゆめさき",
      "わかば",
      "みやこ",
      "よこやま",
      "しらいし",
      "いまい",
      "くらた",
      "いちの",
      "かわしま",
      "ひびき",
      "たかなし",
      "かねしろ",
      "しいな",
      "みうら",
      "あまみや",
      "おかだ",
      "くるす",
      "しのはら",
      "いちのせ",
      "かしわぎ",
      "のはら",
      "おとは",
      "みなせ",
      "たかはし",
      "しらかわ",
      "みさき",
      "さかもと",
      "まつもと",
      "よしかわ",
      "あいか",
      "こいけ"
    ]
  },
  "shop_4": {
    "name": "アロマエレガンス",
    "sheetName": "アロマエレガンス",
    "supabaseShopId": "d45829ba-a7e3-48d8-8b09-5e49b9f494a7",
    "rooms": {
      "1": {
        "name": "西新宿ルーム①",
        "color": "#00FFFF"
      },
      "2": {
        "name": "西新宿ルーム②",
        "color": "#FFFF00"
      },
      "3": {
        "name": "西新宿ルーム③",
        "color": "#00FF00"
      },
      "4": {
        "name": "西新宿ルーム④",
        "color": "#FF9900"
      },
      "5": {
        "name": "西新宿ルーム⑤",
        "color": "#FF00FF"
      },
      "6": {
        "name": "西新宿ルーム⑥",
        "color": "#A4C2F4"
      },
      "7": {
        "name": "西新宿ルーム⑦",
        "color": "#D9EAD3"
      },
      "8": {
        "name": "西新宿ルーム⑧",
        "color": "#FFE599"
      },
      "9": {
        "name": "西新宿ルーム⑨",
        "color": "#F4CCCC"
      }
    },
    "staffList": [
      "えあ",
      "ALICE",
      "えみり",
      "あい",
      "しゅる",
      "ゆゆ",
      "ノア",
      "ひまり",
      "はるか",
      "かな",
      "ゆあ",
      "おと",
      "こゆき",
      "ひめ",
      "ナナ",
      "リコ",
      "さな",
      "ルリ",
      "れむ",
      "あずさ",
      "すもも",
      "こころ",
      "りん",
      "リリ",
      "ミサト",
      "みすず",
      "メイ",
      "ゆね",
      "ひかり",
      "れいな",
      "しずく",
      "きらり",
      "あさみ",
      "みな",
      "さくら",
      "ゆらの",
      "りんか",
      "アンナ",
      "あかね",
      "ゆり",
      "かなの",
      "るな",
      "かんな",
      "まな",
      "あきな",
      "はな",
      "てん",
      "もえ"
    ]
  },
  "shop_5": {
    "name": "アーバンスパ",
    "sheetName": "アーバンスパ",
    "supabaseShopId": "7d430288-8aed-4381-b3bf-f35fad962d2f",
    "rooms": {
      "1": {
        "name": "田仁ハイツ310",
        "color": "#00FFFF"
      },
      "2": {
        "name": "エスコート203",
        "color": "#FFFF00"
      },
      "3": {
        "name": "エスコート204",
        "color": "#00FF00"
      },
      "4": {
        "name": "アヴァン605",
        "color": "#FF9900"
      }
    },
    "staffList": [
      "あんな",
      "マオ",
      "みる",
      "りの",
      "イズミ",
      "ユカリ",
      "レイ",
      "やしろ",
      "ハル",
      "きょうか",
      "める",
      "七瀬えみり",
      "めい",
      "ひな",
      "さや",
      "モモ",
      "サリ",
      "アヤネ",
      "トモミ",
      "アオヤマ",
      "みあ",
      "くるみ",
      "るる",
      "さとみ",
      "さな",
      "加糖ももか",
      "のあ",
      "はすみ",
      "らん",
      "ひすい",
      "れいな",
      "なみ",
      "ばぶ",
      "アンズ",
      "ユウカ",
      "リエ",
      "チアキ",
      "マユミ",
      "ことね",
      "あや",
      "くろえ",
      "さくら",
      "ゆず",
      "なほ",
      "さき",
      "みおん",
      "まや",
      "ひめか",
      "れむ",
      "ののか",
      "まなみ",
      "ちあき",
      "りり",
      "のぞみ",
      "ゆう",
      "なの",
      "まほ",
      "もも",
      "のの",
      "なぎさ",
      "らら",
      "すい",
      "ともか",
      "りな",
      "ほのか",
      "れん",
      "まなつ",
      "いおり",
      "橘なの",
      "はな",
      "（ダミー）ゆうか",
      "（ダミー）みさき"
    ]
  },
  "shop_6": {
    "name": "クイーンテラス",
    "sheetName": "ﾃﾗｽ",
    "supabaseShopId": "960d84c5-d1cd-44bc-a39a-85f8ecc3d51a",
    "rooms": {
      "1": {
        "name": "藤沢Aルーム",
        "color": "#00FFFF"
      },
      "2": {
        "name": "大和Aルーム",
        "color": "#FFFF00"
      },
      "3": {
        "name": "海老名ルーム",
        "color": "#00FF00"
      },
      "4": {
        "name": "大和Bルーム",
        "color": "#FF9900"
      },
      "5": {
        "name": "藤沢Bルーム",
        "color": "#FF00FF"
      }
    },
    "staffList": [
      "雪村しう",
      "愛沢きらら",
      "綾瀬なつ",
      "綾瀬ゆき",
      "一ノ瀬ゆず",
      "一条あき",
      "佐伯ひな",
      "遠藤",
      "森川さとみ",
      "夏川じゅん",
      "夏目ようこ",
      "雨宮ゆうな",
      "宮崎めい",
      "橋本なつみ",
      "芹沢ゆな",
      "芹澤れいら",
      "伊藤はる",
      "月島ゆり",
      "月野",
      "月野まよい",
      "高峰はな",
      "高木ゆうり",
      "高野さくら",
      "黒木えりい",
      "佐々木あや",
      "佐藤るな",
      "桜井ゆな",
      "桜木なな",
      "三島ねね",
      "春菜ふうか",
      "七瀬せな",
      "河合ゆめ",
      "春野ちひろ",
      "小笠原さえ",
      "深田",
      "深田ゆみ",
      "星川りんか",
      "星野みなみ",
      "前田みつき",
      "鈴木えま",
      "和泉ひな",
      "天野りお",
      "平野ゆりか",
      "倉持ゆりあ",
      "大橋まお",
      "大谷みずき",
      "中村れん",
      "椎名みさ",
      "田中める",
      "立花るな",
      "藍沢なぎ",
      "鳴海るい",
      "峯岸はな",
      "峰岸はな",
      "美波ゆい",
      "白石てん",
      "白井まゆき",
      "藤岡あおい",
      "愛原まい",
      "櫻井ゆな",
      "一護みるく",
      "吉川ゆみ",
      "月野のあ",
      "佐藤はるひ",
      "山田ちより",
      "成瀬ねね",
      "瀧谷あんな",
      "一宮える",
      "朝比奈ゆい",
      "早乙女つばさ",
      "姫野さら",
      "三上もも",
      "高橋なつ",
      "高梨りな",
      "相馬みさき",
      "児島ちほ",
      "今野りん",
      "蒼井ゆあ",
      "阿部なつき",
      "泉なぎさ",
      "天使ゆず",
      "結城みこと",
      "山下ちはる",
      "白石ななせ",
      "朝日奈かりん",
      "十条ゆい"
    ]
  },
  "shop_7": {
    "name": "クリスタルスパ",
    "sheetName": "クリスタルスパ",
    "supabaseShopId": "1faab510-3c7e-4a01-9ce6-d3b93bbdad81",
    "rooms": {
      "1": {
        "name": "ルーム② 307",
        "color": "#00FFFF"
      },
      "2": {
        "name": "ルーム④301",
        "color": "#FFFF00"
      },
      "3": {
        "name": "ルーム① 205",
        "color": "#00FF00"
      },
      "4": {
        "name": "ルーム③202",
        "color": "#FF9900"
      }
    },
    "staffList": [
      "ゆあ",
      "つむぎ",
      "あんじゅ",
      "まお",
      "いちか",
      "こはる",
      "ねね",
      "かえで",
      "のあ",
      "れい",
      "ひなた",
      "にこ",
      "ここ",
      "りか",
      "みずき",
      "すい",
      "そら",
      "なぎ",
      "きき",
      "るる",
      "あい"
    ]
  },
  "shop_8": {
    "name": "シークレットモーメント",
    "sheetName": "シークレットモーメント",
    "supabaseShopId": "a0000001-0000-0000-0000-000000000002",
    "rooms": {
      "1": {
        "name": "ルーム⑥（千種クラシア605）",
        "color": "#00FFFF"
      },
      "2": {
        "name": "ルーム③（千種クラシア305）",
        "color": "#FFFF00"
      },
      "3": {
        "name": "ルーム①（今池プレサンス802）",
        "color": "#00FF00"
      },
      "4": {
        "name": "ルーム④（千種クラシア505）",
        "color": "#FF9900"
      },
      "5": {
        "name": "	ルーム⑦（千種カーサ602）",
        "color": "#FF00FF"
      }
    },
    "staffList": [
      "ゆの",
      "そあ",
      "こはね",
      "さきな",
      "みらい",
      "せいら",
      "さち",
      "こはる",
      "にあ",
      "えま",
      "ゆり",
      "せな",
      "まい",
      "あお",
      "みゆう",
      "ひな",
      "ひめ",
      "あめ",
      "うる",
      "みれい",
      "かえで",
      "ゆりか",
      "ゆい",
      "あい",
      "えり",
      "いちか",
      "かれん",
      "のの",
      "ゆき",
      "はるか",
      "もも",
      "まりな",
      "かえ",
      "るか",
      "みく",
      "みお",
      "さくら",
      "りん",
      "のどか",
      "ゆめ",
      "あず",
      "りり",
      "いと",
      "みゆ",
      "なな",
      "まりあ",
      "める",
      "あかね",
      "えな",
      "るな",
      "えれな",
      "せり",
      "みみ",
      "るい",
      "りくす",
      "とあ",
      "りん",
      "みく",
      "ゆあ",
      "せれな",
      "はな",
      "ねね",
      "りのん",
      "みらん",
      "なつき"
    ]
  },
  "shop_9": {
    "name": "タイガーリリー",
    "sheetName": "タイガーリリー",
    "supabaseShopId": "4808aee9-9940-410c-aa5b-dd1364e2da2c",
    "rooms": {
      "1": {
        "name": "ルーム①",
        "color": "#00FFFF"
      }
    },
    "staffList": [
      "神崎 るな",
      "乃咲 えな",
      "藤崎 かな",
      "天野 うた",
      "西園寺 ひめか",
      "星野 あいり",
      "神崎 るな",
      "姫野 りな",
      "望月 ゆめ",
      "一条 ひかり",
      "音羽 かなで",
      "星谷 さおり",
      "天海 そら",
      "如月 さやか",
      "瑞越 めい",
      "岸野 ゆか"
    ]
  },
  "shop_10": {
    "name": "ノエル",
    "sheetName": "ノエル",
    "supabaseShopId": "0ffa0c56-c61f-4e41-95a2-8ec3028eefdc",
    "rooms": {
      "1": {
        "name": "プラース 704",
        "color": "#00FFFF"
      },
      "2": {
        "name": "GRANSITE 602",
        "color": "#FFFF00"
      }
    },
    "staffList": [
      "橋本ゆみ",
      "水野さゆ",
      "一ノ瀬もも",
      "山本ゆき",
      "長谷川るな",
      "桜井ふうか",
      "伊藤みなみ",
      "有栖れな"
    ]
  },
  "shop_11": {
    "name": "ラビット町田",
    "sheetName": "ラビット町田",
    "supabaseShopId": "933b0d5a-d436-453d-a8bc-8741a74a52c9",
    "rooms": {
      "1": {
        "name": "プライマル町田206",
        "color": "#00FFFF"
      },
      "2": {
        "name": "グリーンパレス町田603",
        "color": "#FFFF00"
      },
      "3": {
        "name": "アーバンフラッツ町田1404",
        "color": "#00FF00"
      }
    },
    "staffList": [
      "いちご",
      "ゆえ",
      "みるく",
      "すず",
      "ここな",
      "らん",
      "きい",
      "てんしちゃん",
      "なほ",
      "はづき",
      "なごみ",
      "ゆず",
      "ひまり",
      "いつき",
      "しほ",
      "ゆうは",
      "えま",
      "せつな",
      "ふう",
      "いおり",
      "ゆき",
      "さとみ",
      "えみい",
      "たまき",
      "らら",
      "なの",
      "ゆな",
      "りあ",
      "ひかり",
      "るな",
      "ひな",
      "もな",
      "ももな",
      "れな",
      "いおな",
      "みゆ",
      "こはる",
      "ゆん",
      "りな",
      "みこと",
      "のあ",
      "ゆりあ"
    ]
  },
  "shop_12": {
    "name": "ラビット立川",
    "sheetName": "ラビット立川",
    "supabaseShopId": "a0000001-0000-0000-0000-000000000003",
    "rooms": {
      "1": {
        "name": "八王子03：【利用不可】明神町ウィンズ207",
        "color": "#00FFFF"
      },
      "2": {
        "name": "立川07：エゴン・シーレ301（鍵別設置）",
        "color": "#FFFF00"
      },
      "3": {
        "name": "立川09:マ・メゾン立川305",
        "color": "#00FF00"
      },
      "4": {
        "name": "八王子02：ISグランデ寺町507",
        "color": "#FF9900"
      },
      "5": {
        "name": "立川04：【利用不可】レアライズ立川410",
        "color": "#FF00FF"
      },
      "6": {
        "name": "	立川02：メインステージ立川706",
        "color": "#A4C2F4"
      },
      "7": {
        "name": "立川01：プレステージ立川605",
        "color": "#D9EAD3"
      },
      "8": {
        "name": "立川03：グランツ立川306",
        "color": "#FFE599"
      },
      "9": {
        "name": "立川06：レアライズ立川606",
        "color": "#F4CCCC"
      },
      "10": {
        "name": "立川08:センティーレ101",
        "color": "#E6B8AF"
      },
      "11": {
        "name": "八王子01：シャン・ヴァロン明神町205",
        "color": "#00FFFF"
      },
      "12": {
        "name": "八王子04：ディラヴェール八王子1304",
        "color": "#FFFF00"
      }
    },
    "staffList": [
      "かんな",
      "るな",
      "ゆえ",
      "ゆん",
      "なみ",
      "ひなた",
      "ひまり",
      "さき",
      "ここな",
      "うる",
      "あいら",
      "ももな",
      "すみか",
      "はな",
      "りら",
      "ここみ",
      "ありす",
      "あきな",
      "くるみ",
      "りのん",
      "あやの",
      "くれあ",
      "せいら",
      "ひなこ",
      "なごみ",
      "りお",
      "えみり",
      "れの",
      "なの",
      "えみい",
      "ゆあ",
      "さくらこ",
      "れいな",
      "あすか",
      "せつな",
      "すず",
      "いちご",
      "くれは",
      "いおな",
      "ゆな",
      "りあ",
      "ゆうは",
      "みゆ",
      "ふう",
      "なほ",
      "ゆず",
      "ゆりあ",
      "かりん",
      "きい",
      "たまき",
      "ゆり",
      "もな",
      "いおり",
      "すみれ",
      "みく",
      "こはる",
      "はるな",
      "らら",
      "かおり",
      "ふぶき",
      "ゆき",
      "ひかり",
      "みさ",
      "みずき",
      "しほ",
      "れな",
      "れい",
      "なぎ",
      "はる",
      "まな",
      "てんしちゃん",
      "てん",
      "えれな",
      "うさぎ",
      "まみな",
      "ふじの",
      "さな",
      "あいり",
      "あまね",
      "りん",
      "さゆ",
      "かのん",
      "ひびき",
      "あやか",
      "めい",
      "あかり",
      "ひめか",
      "きなこ",
      "いのり",
      "らん",
      "はづき",
      "ゆら",
      "ゆめ",
      "えま",
      "ねね",
      "いつき",
      "もも",
      "りり",
      "ゆめな",
      "のの",
      "わかな",
      "あみか",
      "いろは",
      "みらの"
    ]
  },
  "shop_13": {
    "name": "レジェンド",
    "sheetName": "レジェンド",
    "supabaseShopId": "36949671-c90c-4cf9-9d88-51bd71a2b352",
    "rooms": {
      "1": {
        "name": "ひばり305A",
        "color": "#00FFFF"
      },
      "2": {
        "name": "ひばり305B",
        "color": "#FFFF00"
      },
      "3": {
        "name": "三鷹302",
        "color": "#00FF00"
      },
      "4": {
        "name": "府中504",
        "color": "#FF9900"
      },
      "5": {
        "name": "目白801",
        "color": "#FF00FF"
      }
    },
    "staffList": [
      "柴咲 あみ",
      "月島 るな",
      "藤咲 りこ",
      "姫咲 ふう",
      "夢乃 きらら",
      "森川 ゆずは",
      "白咲 あんな",
      "神楽 このみ",
      "白石 ひかり",
      "吉岡 まお",
      "滝沢 みみ",
      "氷川 しろ",
      "真白 もも",
      "結乃 りあ",
      "橋本 らむ",
      "白雪 ありす",
      "桃乃木 ひな",
      "羽澄 ありさ",
      "夏目 まゆ",
      "水瀬 みり",
      "天音 まいか",
      "桜川 れいら",
      "心美 まや",
      "春名 ふうこ",
      "柊 ほのか",
      "若葉 かおり",
      "桜木 みお",
      "桜井 いずみ",
      "東條 まりあ",
      "黒名 ゆい",
      "柏木 ひな",
      "北川 ゆず"
    ]
  },
  "shop_14": {
    "name": "ローズカフェ",
    "sheetName": "ﾛｰｽﾞｶﾌｪ",
    "supabaseShopId": "a0000001-0000-0000-0000-000000000005",
    "rooms": {
      "1": {
        "name": "東梅田ルーム",
        "color": "#00FFFF"
      },
      "2": {
        "name": "梅田ルーム",
        "color": "#FFFF00"
      },
      "3": {
        "name": "西天満ルーム",
        "color": "#00FF00"
      }
    },
    "staffList": [
      "うさぎ",
      "葵",
      "綾海",
      "伊緒莉",
      "響歌",
      "芹那",
      "結奈",
      "胡望",
      "瑚夏",
      "香凛",
      "彩花",
      "彩葉",
      "詩",
      "実和",
      "樹",
      "春井",
      "松島",
      "真白",
      "雪音",
      "日和",
      "白石",
      "帆花",
      "風夏",
      "優空",
      "優木",
      "陽向",
      "陽咲",
      "鈴科",
      "鈴香",
      "恋雪",
      "凛花",
      "花宮",
      "若葉",
      "芹奈"
    ]
  },
  "shop_15": {
    "name": "新宿秘密妻",
    "sheetName": "新宿秘密妻",
    "supabaseShopId": "774101be-d8c5-4ca5-ba4a-fc61c039fbaa",
    "rooms": {
      "1": {
        "name": "エスコート203",
        "color": "#00FFFF"
      }
    },
    "staffList": [
      "リン",
      "アン",
      "アイラ",
      "マオ",
      "ユカリ",
      "イズミ",
      "レイ",
      "マヤ",
      "シズク",
      "ハル",
      "トモミ",
      "モモ",
      "サリ",
      "アヤネ",
      "アオヤマ",
      "マユミ",
      "チアキ",
      "リエ",
      "ハスミ",
      "ユリ",
      "アヤノ",
      "アリサ",
      "サトミ",
      "ユウカ",
      "アンズ",
      "ヒスイ",
      "サクヤ",
      "アオノ"
    ]
  },
  "shop_16": {
    "name": "淑女の秘密スパ",
    "sheetName": "淑女の秘密スパ",
    "supabaseShopId": "3464ed8c-44e8-46f1-b701-9b6ae0f465a8",
    "rooms": {
      "1": {
        "name": "月村マンションNO,29　903",
        "color": "#00FFFF"
      }
    },
    "staffList": [
      "白川めい",
      "東条ゆい",
      "宇佐美りこ",
      "朝比奈かえで",
      "松下さえこ",
      "由井まどか",
      "常磐みづき",
      "仲間えみ",
      "山本りな",
      "倖田かのん",
      "岡村ひとみ",
      "三上まや",
      "城田あかり",
      "白石はるか",
      "綾瀬まお",
      "桜井あやの",
      "本庄ゆま",
      "真嶋しおり",
      "葉山ふうか",
      "七瀬ひかり",
      "佐々木えりか",
      "井上らん",
      "橋本しほ",
      "神崎ななみ",
      "美原すみれ",
      "中村ありさ",
      "佐藤あみ",
      "蒼井ゆうき",
      "美月るみ",
      "関あおい"
    ]
  },
  "shop_17": {
    "name": "神々のスパ",
    "sheetName": "神々のスパ",
    "supabaseShopId": "3d4e98bd-ed3f-4bea-8327-4891d65c427c",
    "rooms": {
      "1": {
        "name": "セントラルアベニュー",
        "color": "#00FFFF"
      }
    },
    "staffList": [
      "ゆき",
      "はな",
      "れな",
      "さき",
      "にいな",
      "ゆあ",
      "さら",
      "りり",
      "るな",
      "のあ"
    ]
  },
  "shop_18": {
    "name": "裏妻SPA",
    "sheetName": "裏妻SPA",
    "supabaseShopId": "da3ac7a8-e84d-4dbd-830c-81e9e8b6631a",
    "rooms": {
      "1": {
        "name": "ルームB 207",
        "color": "#00FFFF"
      },
      "2": {
        "name": "ルームA 201",
        "color": "#FFFF00"
      },
      "3": {
        "name": "ルームC 901",
        "color": "#00FF00"
      },
      "4": {
        "name": "ルームD 201",
        "color": "#FF9900"
      }
    },
    "staffList": [
      "こはる",
      "ゆい",
      "みなみ",
      "なな",
      "みさき",
      "ひな",
      "らん",
      "あかね",
      "ゆり",
      "さくら",
      "もも",
      "みき",
      "ゆうな",
      "ゆきの",
      "あすみ",
      "りお",
      "りな",
      "えま",
      "まりん",
      "あい",
      "みずき",
      "あんな",
      "あやか",
      "たまき"
    ]
  },
  "shop_19": {
    "name": "辻堂茅ヶ崎",
    "sheetName": "辻堂茅ヶ崎",
    "supabaseShopId": "92c51e51-339b-48ce-8535-0f45c859b195",
    "rooms": {
      "1": {
        "name": "②グレーシア201",
        "color": "#F4CCCC"
      },
      "2": {
        "name": "①ドミトリー504",
        "color": "#00FF00"
      },
      "3": {
        "name": "③辻堂401",
        "color": "#D9D2E9"
      }
    },
    "staffList": [
      "いとう安奈",
      "吉沢りょうか",
      "山手のぞみ",
      "渋谷あいり",
      "大和さくら子",
      "藤原ゆう",
      "藤咲みほ",
      "南野もも",
      "花京院さやか",
      "花咲はな",
      "桜咲",
      "山本まりこ",
      "青山はるか",
      "川島ゆい",
      "相楽えりか",
      "二階堂めい",
      "白石",
      "唯月みあ",
      "一ノ瀬なな",
      "天音",
      "桜木あや",
      "森みいこ"
    ]
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📅 シフト管理')
    .addItem('テキストからシフト追加', 'showSidebar')
    .addItem('YOYAKLからシフトを同期', 'showSyncDialog')
    .addItem('YOYAKLへデータを出力（同期）', 'exportDataToYoyakl')
    .addToUi();
}

function showSidebar() {
  const template = HtmlService.createTemplateFromFile('Sidebar');
  template.SHOP_CONFIG = SHOP_CONFIG;
  const html = template.evaluate()
    .setTitle('📅 シフト追加')
    .setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showSyncDialog() {
  const template = HtmlService.createTemplateFromFile('SyncDialog');
  template.SHOP_CONFIG = SHOP_CONFIG;
  const html = template.evaluate()
    .setTitle('🔄 YOYAKLからシフト同期')
    .setWidth(350)
    .setHeight(250);
  SpreadsheetApp.getUi().showModalDialog(html, '🔄 YOYAKLからシフト同期');
}

// ----------------------------------------------------
// YOYAKL から出勤情報を同期する処理
// ----------------------------------------------------
function syncShiftsFromYoyakl(shopKey, dateFrom, dateTo) {
  const config = SHOP_CONFIG[shopKey];
  if (!config) throw new Error('店舗設定が見つかりません');
  if (config.supabaseShopId === 'YOUR_LEGEND_SUPABASE_SHOP_ID') {
    throw new Error('レジェンドの supabaseShopId を設定してください');
  }

  // Next.jsで作成した public 同期APIを叩く
  const token = 'yoyakl_sync_token_2026'; // アプリの SYNC_API_TOKEN と一致させる
  // TODO: 本番稼働時は 'https://your-yoyakl-domain.com' に置き換えてください
  const baseUrl = 'http://localhost:3000';
  const url = `${baseUrl}/api/public/shifts?shop_id=${config.supabaseShopId}&date_from=${dateFrom}&date_to=${dateTo}&token=${token}`;

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code !== 200) {
    throw new Error(`YOYAKL 同期失敗: ${text}`);
  }

  const result = JSON.parse(text);
  const shifts = result.shifts || [];

  if (shifts.length === 0) {
    return `⚠️ ${config.name} の指定期間（${dateFrom} 〜 ${dateTo}）に出勤情報がありませんでした。`;
  }

  // スプレッドシート側の書き込み用オブジェクトに変換
  const formattedShifts = shifts.map(s => {
    // room_name から config.rooms のルームID(1, 2, 3...)を逆引き
    const roomId = findRoomId(s.room_name, config.rooms);

    return {
      date: s.date,
      room: roomId || 1, // ルームが見つからない場合は第1ルーム
      staff: s.staff_label, // インターバルを含んだ名前（例: "すい20"）
      start: s.start_time.replace(':', ''),
      end: s.end_time.replace(':', '')
    };
  });

  return formatAndSaveShifts(formattedShifts, shopKey);
}

// ----------------------------------------------------
// テキスト入力からの解析処理
// ----------------------------------------------------
function processTextShift(shiftText, shopKey) {
  const config = SHOP_CONFIG[shopKey];
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

  const prompt = `
以下の「${config.name}」のシフトテキストを解析し、JSON配列のみを出力してください。

【シフトテキスト】
${shiftText}

【絶対厳守の命令】
1. すべてのスタッフのシフトを1件残らず抽出してください。省略禁止です。
2. スタッフ名は「名前＋インターバル数字」の形式（例: 白石ななせ20、鈴木えま20）を保持してください。苗字だけや名前のみに加工せず、入力された通りのフルネーム＋数字で出力してください。
3. 日付は「必ず2026年」として扱ってください。出力は必ず 2026-MM-DD 形式にしてください。
4. 深夜時間（25:00等や、翌2時を表す「18-2」の「2」等）は、「2500」「0200」のように4桁の数字として抽出してください。
5. エリア名とルーム名が記載されている場合は、それらを組み合わせて該当するルーム番号を正しく判定してください。

スタッフ候補: ${config.staffList.join(', ')}

ルームのマッピング: ${Object.keys(config.rooms).map(k => config.rooms[k].name + 'は' + k).join(', ')}。

出力形式 (JSON配列のみ):
[{"date":"2026-MM-DD", "room":数値, "staff":"フルネーム（数字含む）", "start":"HHMM", "end":"HHMM"}]
`;

  const payload = {
    "contents": [{
      "parts": [{ "text": prompt }]
    }],
    "generationConfig": {
      "temperature": 0.0,
      "maxOutputTokens": 8000,
      "responseMimeType": "application/json"
    }
  };

  const response = UrlFetchApp.fetch(apiUrl, {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  });
 
  const result = JSON.parse(response.getContentText());
  if (result.error) throw new Error('API Error: ' + result.error.message);

  const text = result.candidates[0].content.parts[0].text;
  const startIndex = text.indexOf('[');
  const endIndex = text.lastIndexOf(']');
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    throw new Error('JSON抽出失敗: ' + text);
  }

  const jsonText = text.substring(startIndex, endIndex + 1);
  let shifts = JSON.parse(jsonText);
  return formatAndSaveShifts(shifts, shopKey);
}

// ----------------------------------------------------
// 年と時間の補正＆シート書き込み処理
// ----------------------------------------------------
function formatAndSaveShifts(shifts, shopKey) {
  shifts = shifts.map(shift => {
    let dateStr = shift.date;
    if (dateStr && dateStr.length >= 10) {
      dateStr = "2026" + dateStr.substring(4);
    }

    return {
      ...shift,
      date: dateStr,
      start: formatTime(shift.start),
      end: formatTime(shift.end)
    };
  });

  return processShifts(shifts, shopKey);
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  let cleanTime = timeStr.toString().replace(/[^0-9]/g, '');
  cleanTime = cleanTime.padStart(4, '0');

  const hour = parseInt(cleanTime.substring(0, 2), 10);
  if (hour >= 0 && hour <= 9) {
    const newHour = hour + 24;
    cleanTime = newHour.toString() + cleanTime.substring(2);
  }
  return cleanTime;
}

function processShifts(shifts, shopKey) {
  const config = SHOP_CONFIG[shopKey];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(config.sheetName);
 
  if (!sheet) throw new Error(`シート「${config.sheetName}」が見つかりません。シートを作成してください。`);

  let lastCol = findLastDataColumn(sheet);
  if (lastCol > 0) lastCol += 1;
  let addedCount = 0;

  if (shopKey === 'shop_d') {
    // ------------------------------------------------------
    // ★ レジェンド（shop_d）専用の書き込みロジック
    // 1. 武蔵浦和（room=5）のシフトだけを抽出し、日付順・時間順で書き込む
    // 2. 1列空ける
    // 3. その他のシフトを抽出し、日付順・時間順で書き込む
    // ------------------------------------------------------
   
    // 1. 武蔵浦和（room: 5）の処理
    const musashiShifts = shifts.filter(s => s.room == 5);
    if (musashiShifts.length > 0) {
      // 日付 > 時間 の順にソート
      musashiShifts.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start.localeCompare(b.start);
      });
     
      let currentDate = musashiShifts[0].date;
      musashiShifts.forEach(shift => {
        // 日付が変わったら1列空ける（ご希望に合わせて変更可能。不要なら削除してください）
        if (shift.date !== currentDate) {
          lastCol++;
          currentDate = shift.date;
        }
        lastCol++;
        writeShift(sheet, lastCol, shift, config.rooms);
        addedCount++;
      });
      // 武蔵浦和とその他の間に1列空ける
      lastCol++;
    }

    // 2. その他（room: 1, 2, 3, 4）の処理
    const otherShifts = shifts.filter(s => s.room != 5);
    if (otherShifts.length > 0) {
      // 日付 > 時間 の順にソート
      otherShifts.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start.localeCompare(b.start);
      });
     
      let currentDate = otherShifts[0].date;
      otherShifts.forEach(shift => {
        // 日付が変わったら1列空ける
        if (shift.date !== currentDate) {
          lastCol++;
          currentDate = shift.date;
        }
        lastCol++;
        writeShift(sheet, lastCol, shift, config.rooms);
        addedCount++;
      });
      lastCol++;
    }

  } else {
    // ------------------------------------------------------
    // ★ その他の店舗（従来通りの日付ごとにまとめて書き込むロジック）
    // ------------------------------------------------------
    const grouped = {};
    shifts.forEach(shift => {
      const d = shift.date;
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(shift);
    });

    const sortedDates = Object.keys(grouped).sort();

    sortedDates.forEach(date => {
      const dayShifts = grouped[date];
      dayShifts.sort((a, b) => a.start.localeCompare(b.start));

      dayShifts.forEach(shift => {
        lastCol++;
        writeShift(sheet, lastCol, shift, config.rooms);
        addedCount++;
      });
      lastCol++;
    });
  }

  return `✅ ${config.name}に${addedCount}件を追加しました！`;
}

function findLastDataColumn(sheet) {
  const maxCols = sheet.getMaxColumns();
  for (let col = maxCols; col >= 1; col--) {
    if (sheet.getRange(1, col).getValue() !== '') return col;
  }
  return 0;
}

function writeShift(sheet, colIndex, shift, roomConfig) {
  // ルーム設定がない店舗や、該当するルームIDがない場合のデフォルト値
  let roomName = 'ルーム';
  let roomColor = '#ffffff'; // 白色

  if (roomConfig && roomConfig[shift.room]) {
    roomName = roomConfig[shift.room].name;
    roomColor = roomConfig[shift.room].color;
  }

  const row1Range = sheet.getRange(1, colIndex);
  const dateObj = new Date(shift.date.replace(/-/g, '/'));
  row1Range.setValue(dateObj);
  row1Range.setNumberFormat('M月D日(aaa)');

  sheet.getRange(4, colIndex).setValue(shift.staff);
  const row5 = sheet.getRange(5, colIndex);
  row5.setValue(roomName).setBackground(roomColor);
 
  sheet.getRange(6, colIndex).setValue(shift.start + '-' + shift.end);
  sheet.getRange(1, colIndex, 6, 1).setHorizontalAlignment('center');
}

// ----------------------------------------------------
// Next.js からのシフト登録時自動同期用エントリポイント(POST)
// ----------------------------------------------------
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { token, shopId, shifts } = payload;

    // 簡易トークン認証
    const expectedToken = PropertiesService.getScriptProperties().getProperty('SYNC_API_TOKEN') || 'yoyakl_sync_token_2026';
    if (token !== expectedToken) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: '認証トークンが無効です' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (!shopId) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'shopId が指定されていません' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // shopId (supabaseShopId) に一致する店舗設定を逆引き
    let shopKey = null;
    for (const key in SHOP_CONFIG) {
      if (SHOP_CONFIG[key].supabaseShopId === shopId) {
        shopKey = key;
        break;
      }
    }

    if (!shopKey) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: `店舗ID「${shopId}」に対応する設定が見つかりません。` }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (!shifts || !Array.isArray(shifts)) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: '有効なシフトデータがありません' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const config = SHOP_CONFIG[shopKey];

    // スプレッドシート書き込み用データへ整形
    const formattedShifts = shifts.map(s => {
      // room_name から config.rooms のルームID(1, 2, 3...)を逆引き
      const roomId = findRoomId(s.room_name, config.rooms);

      return {
        date: s.date,
        room: roomId || 1, // ルームが見つからない場合は第1ルーム
        staff: s.staff_label, // インターバルを含んだ名前（例: "すい20"）
        start: s.start_time.replace(':', ''),
        end: s.end_time.replace(':', '')
      };
    });

    const resultMsg = formatAndSaveShifts(formattedShifts, shopKey);

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: resultMsg }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ----------------------------------------------------
// ルーム名正規化および曖昧マッチング用ヘルパー
// ----------------------------------------------------
function normalizeRoomName(name) {
  if (!name) return '';
  return name.toString()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '') // 空白・全角スペースを除去
    .replace(/ルーム/g, '')      // 「ルーム」を除去
    .replace(/room/g, '');       // 「room」を除去
}

function findRoomId(roomName, configRooms) {
  if (!roomName) return null;
  const normalizedInput = normalizeRoomName(roomName);

  // 1. 完全一致（正規化後）
  for (const key in configRooms) {
    if (normalizeRoomName(configRooms[key].name) === normalizedInput) {
      return key;
    }
  }

  // 2. 部分一致
  for (const key in configRooms) {
    const normalizedConfig = normalizeRoomName(configRooms[key].name);
    if (normalizedConfig.indexOf(normalizedInput) !== -1 || normalizedInput.indexOf(normalizedConfig) !== -1) {
      return key;
    }
  }

  return null;
}

// ----------------------------------------------------
// スプレッドシートから YOYAKL への直接データ出力（同期）
// ----------------------------------------------------

// 時刻文字列またはDateオブジェクトから分を計算するヘルパー
function toMinutes(cell) {
  if (cell == null || cell === "") return null;
  if (cell instanceof Date) return cell.getHours() * 60 + cell.getMinutes();
  if (typeof cell === "number") {
    const total = Math.round(cell * 24 * 60);
    const h = Math.floor(total / 60) % 24, m = total % 60;
    return h * 60 + m;
  }
  if (typeof cell === "string") {
    const mm = cell.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (mm) {
      const h = parseInt(mm[1], 10), m = parseInt(mm[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m;
    }
  }
  return null;
}

// 分を HH:mm 形式の文字列にするヘルパー
function minutesToHm(min) {
  let h = Math.floor(min / 60);
  let m = min % 60;
  if (h >= 24) {
    h = h - 24;
  }
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// 24時間以上の時間表記を分に変換するヘルパー
function hmToMinutesAllowing24Plus(hm) {
  let h, m;
  if (/^\d{4}$/.test(hm)) {
    h = parseInt(hm.slice(0, 2), 10);
    m = parseInt(hm.slice(2, 4), 10);
  } else if (/^\d{1,2}:\d{2}$/.test(hm)) {
    const p = hm.split(":"); h = parseInt(p[0], 10); m = parseInt(p[1], 10);
  } else {
    return null;
  }
  if (isNaN(h) || isNaN(m) || m < 0 || m > 59) return null;
  if (h < 0 || h > 29) return null;

  if (h <= 23) return h * 60 + m;      // 当日
  if (h === 24) return 1440 + m;       // 24:xx
  return (h - 24) * 60 + m + 1440;     // 25:00〜29:59
}

// 予約セルのパース
function parseReservationCell(text, defaultStart, defaultEnd, defaultDuration) {
  if (!text) return null;
  text = text.trim();
  if (text === '') return null;

  // 改行で分割
  const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
  if (lines.length === 0) return null;

  let timeStr = '';
  let customerLine = '';
  let memoLines = [];

  // 1行目が時間帯であるかチェック
  const timeRegex = /(\d{1,2})[：:]?(\d{2})[\s\-〜~ー]+(\d{1,2})[：:]?(\d{2})/;
  const timeMatch = lines[0].match(timeRegex);

  if (timeMatch) {
    timeStr = lines[0];
    if (lines.length > 1) {
      customerLine = lines[1];
      memoLines = lines.slice(2);
    }
  } else {
    // 1行目に時間帯がない場合、テキスト全体から時間帯を探す
    const inlineMatch = text.match(timeRegex);
    if (inlineMatch) {
      const matchedTime = inlineMatch[0];
      timeStr = matchedTime;
      customerLine = text.replace(matchedTime, '').trim();
    } else {
      // 時間帯が見つからない場合は、結合セルのデフォルト時間を使用し、1行目を顧客名とする
      customerLine = lines[0];
      memoLines = lines.slice(1);
    }
  }

  let startTime = defaultStart;
  let endTime = defaultEnd;
  let duration = defaultDuration;

  if (timeStr) {
    const parsedTime = timeStr.match(timeRegex);
    if (parsedTime) {
      const startH = parsedTime[1].padStart(2, '0');
      const startM = parsedTime[2];
      const endH = parsedTime[3].padStart(2, '0');
      const endM = parsedTime[4];
      startTime = `${startH}:${startM}`;
      endTime = `${endH}:${endM}`;
      
      const startMin = hmToMinutesAllowing24Plus(startTime);
      const endMin = hmToMinutesAllowing24Plus(endTime);
      duration = (startMin != null && endMin != null) ? (endMin - startMin) : defaultDuration;
    }
  }

  // 顧客名、電話番号、指名区分のパース
  let customerName = 'ゲスト';
  let phoneSuffix = '';
  let designation = 'free';

  if (customerLine) {
    // 電話番号下4桁の抽出
    const phoneMatch = customerLine.match(/\d{4}/);
    if (phoneMatch) {
      phoneSuffix = phoneMatch[0];
      customerLine = customerLine.replace(phoneSuffix, '');
    }

    // 指名区分およびキャンセル・休憩の抽出と判定
    const cleanLower = customerLine.toLowerCase();
    
    // C（キャンセル）および Z（休憩・インターバル）は YOYAKL に登録しないため除外
    if (cleanLower.indexOf('c') !== -1 || cleanLower.indexOf('ｃ') !== -1) {
      return null;
    }
    if (cleanLower.indexOf('z') !== -1 || cleanLower.indexOf('ｚ') !== -1) {
      return null;
    }

    // メモ書きセル（例: "2530-90までOK" など）の除外
    if (cleanLower.indexOf('ok') !== -1 && customerLine.match(/\d+/)) {
      return null;
    }

    if (cleanLower.indexOf('b') !== -1 || cleanLower.indexOf('本') !== -1) {
      designation = 'confirmed';
      customerLine = customerLine.replace(/[bB本]/g, '').replace(/指名/g, '');
    } else if (cleanLower.indexOf('s') !== -1 || cleanLower.indexOf('新') !== -1 || cleanLower.indexOf('初回') !== -1) {
      designation = 'first_nomination';
      customerLine = customerLine.replace(/[sS新]/g, '').replace(/初回(指名)?/g, '');
    } else if (cleanLower.indexOf('指') !== -1) {
      designation = 'nomination';
      customerLine = customerLine.replace(/指(名)?/g, '');
    } else if (cleanLower.indexOf('姫') !== -1) {
      designation = 'princess';
      customerLine = customerLine.replace(/姫(予約)?/g, '');
    }

    // 顧客名のクレンジング (様、括弧、余分なスペースの除去)
    customerName = customerLine
      .replace(/[（\(\)）]/g, '')
      .replace(/様$/, '')
      .trim();

    if (!customerName) {
      customerName = 'ゲスト';
    }
  }

  return {
    startTime: startTime,
    endTime: endTime,
    customerName: customerName,
    phoneSuffix: phoneSuffix,
    designation: designation,
    duration: duration,
    notes: memoLines.join('\n') || text
  };
}

// YOYAKL 同期実行のメイン関数
function exportDataToYoyakl() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const sheetName = sheet.getName();
  const ui = SpreadsheetApp.getUi();

  // 現在のシート名に一致する店舗設定を検索
  let shopKey = null;
  for (const key in SHOP_CONFIG) {
    if (SHOP_CONFIG[key].sheetName === sheetName) {
      shopKey = key;
      break;
    }
  }

  if (!shopKey) {
    ui.alert('❌ 現在アクティブなシート「' + sheetName + '」は店舗設定に登録されていません。');
    return;
  }

  const config = SHOP_CONFIG[shopKey];
  
  const response = ui.alert(
    '🔄 同期確認',
    `店舗「${config.name}」のデータを YOYAKL に直接出力（同期）します。\nよろしいですか？`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  // シートの全データを走査
  const maxCols = sheet.getLastColumn();
  const maxRows = sheet.getLastRow();
  if (maxCols === 0 || maxRows === 0) {
    ui.alert('❌ シートにデータがありません。');
    return;
  }

  // シート内のすべての結合セルを一括ロードしてメモリ上にインデックス化
  const mergedRanges = sheet.getMergedRanges();
  const mergeMap = new Map();
  for (const r of mergedRanges) {
    const startRow = r.getRow();
    const startCol = r.getColumn();
    const endRow = r.getLastRow();
    
    // 左上セルの座標（row_col）をキーにして、結合の開始・終了行を記憶
    mergeMap.set(`${startRow}_${startCol}`, {
      startRow: startRow,
      endRow: endRow
    });
  }

  // セルの値を2次元配列で一括取得（プレーンテキスト）
  const values = sheet.getRange(1, 1, maxRows, maxCols).getDisplayValues();

  const shifts = [];
  const reservations = [];
  const dateSet = new Set();
  const logs = [];

  logs.push(`開始: 列数=${maxCols}, 行数=${maxRows}, 結合セル数=${mergedRanges.length}`);

  for (let colIdx = 4; colIdx < maxCols; colIdx++) { // 5列目（E列以降）は colIdx = 4
    const dateVal = values[0][colIdx];
    if (!dateVal) continue;

    let dateStr = '';
    const dateMatch = dateVal.match(/(\d{4})[/\-年](\d{1,2})[/\-月](\d{1,2})/);
    if (dateMatch) {
      const y = dateMatch[1];
      const m = dateMatch[2].padStart(2, '0');
      const d = dateMatch[3].padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
    } else {
      const shortMatch = dateVal.match(/(\d{1,2})[/\-月](\d{1,2})/);
      if (shortMatch) {
        const m = shortMatch[1].padStart(2, '0');
        const d = shortMatch[2].padStart(2, '0');
        dateStr = `2026-${m}-${d}`;
      }
    }

    if (!dateStr) {
      logs.push(`[列 ${colIdx + 1}] 日付パース失敗: "${dateVal}"`);
      continue;
    }

    // 4行目のスタッフ名 (3行目)
    const staffVal = values[3][colIdx];
    if (!staffVal) continue;

    const staffName = staffVal.trim().replace(/\d+(精算)?$/, '');

    // 5行目のルーム名 (4行目)
    const roomName = values[4][colIdx] ? values[4][colIdx].trim() : '';

    // 6行目の出勤時間 (5行目)
    const timeVal = values[5][colIdx];
    if (!timeVal) {
      logs.push(`[列 ${colIdx + 1}] ${staffName} の出勤時間が空欄です`);
      continue;
    }

    const timeMatch = timeVal.replace(/[^0-9\-]/g, '').match(/^(\d{2})(\d{2})[-〜](\d{2})(\d{2})$/);
    if (!timeMatch) {
      logs.push(`[列 ${colIdx + 1}] ${staffName} の出勤時間フォーマット不正: "${timeVal}"`);
      continue;
    }

    const startH = timeMatch[1];
    const startM = timeMatch[2];
    const endH = timeMatch[3];
    const endM = timeMatch[4];
    const startTime = `${startH}:${startM}`;
    const endTime = `${endH}:${endM}`;

    // 出勤枠の追加
    shifts.push({
      date: dateStr,
      therapist_name: staffName,
      room_name: roomName,
      start_time: startTime,
      end_time: endTime
    });

    dateSet.add(dateStr);

    let colResCount = 0;
    // 7行目以降 (インデックス 6 以降) の予約情報をスキャン
    for (let rowIdx = 6; rowIdx < maxRows; rowIdx++) {
      const cellText = values[rowIdx][colIdx];
      if (!cellText || cellText.trim() === '') continue;

      // 結合情報の取得
      const cellKey = `${rowIdx + 1}_${colIdx + 1}`;
      let startRow = rowIdx + 1;
      let endRow = rowIdx + 1;
      
      if (mergeMap.has(cellKey)) {
        const m = mergeMap.get(cellKey);
        startRow = m.startRow;
        endRow = m.endRow;
      }

      // セル位置からデフォルトの時間を計算 (D列: 4列目 の時刻をパース)
      let startMin = toMinutes(values[startRow - 1][3]);
      if (startMin == null) {
        startMin = 10 * 60 + (startRow - 7) * 10; // フォールバック: 10:00起点で1コマ10分
      }
      const duration = (endRow - startRow + 1) * 10;
      const endMin = startMin + duration;

      const defStart = minutesToHm(startMin);
      const defEnd = minutesToHm(endMin);

      const parsedRes = parseReservationCell(cellText, defStart, defEnd, duration);
      if (parsedRes) {
        reservations.push({
          date: dateStr,
          therapist_name: staffName,
          customer_name: parsedRes.customerName,
          phone_suffix: parsedRes.phoneSuffix || undefined,
          start_time: parsedRes.startTime,
          end_time: parsedRes.endTime,
          duration: parsedRes.duration,
          designation_type: parsedRes.designation,
          notes: parsedRes.notes
        });
        colResCount++;
      } else {
        // デバッグ用にログを記録 (単なる休み等を除く)
        if (cellText.match(/\d+/) && cellText.length < 20) {
          logs.push(`[列 ${colIdx + 1} / 行 ${rowIdx + 1}] 予約パース失敗: "${cellText.replace(/\n/g, ' ')}"`);
        }
      }
    }
    if (colResCount > 0) {
      logs.push(`[列 ${colIdx + 1}] ${staffName} の予約を ${colResCount} 件抽出`);
    }
  }

  // 送信前確認ダイアログの表示
  const sampleMsg = [
    `📊 【データ抽出結果】`,
    `·対象店舗: ${config.name}`,
    `·対象日付: ${Array.from(dateSet).join(', ') || 'なし'}`,
    `·抽出した出勤数: ${shifts.length} 件`,
    `·抽出した予約数: ${reservations.length} 件`,
    ``,
    `■ 予約データのサンプル (最大3件):`,
    reservations.slice(0, 3).map(r => ` - ${r.date} ${r.therapist_name} ➔ ${r.customer_name} (${r.duration}分): ${r.start_time}-${r.end_time}`).join('\n') || 'なし',
    ``,
    `※ 抽出結果が正しい場合は「はい」を押して YOYAKL に送信してください。`,
    `※ 0件になっている場合は、スプレッドシートの入力規則を確認してください。`
  ].join('\n');

  const confirmRes = ui.alert('送信データ確認', sampleMsg, ui.ButtonSet.YES_NO);
  if (confirmRes !== ui.Button.YES) {
    ui.alert('❌ 同期をキャンセルしました。');
    return;
  }

  // YOYAKL API への送信
  const token = 'yoyakl_sync_token_2026';
  // TODO: 本番稼働時は 'https://your-yoyakl-domain.com' に置き換えてください
  const baseUrl = 'http://localhost:3000';
  const url = `${baseUrl}/api/sync-from-spreadsheet`;

  const payload = {
    token: token,
    shopId: config.supabaseShopId,
    dates: Array.from(dateSet),
    shifts: shifts,
    reservations: reservations
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code === 200) {
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        let errorDetail = `サーバーから正常応答(200 OK)を受け取りましたが、データ形式が不正です(JSONではありません)。\n\n`;
        errorDetail += `■ 返ってきた内容 (先頭500文字):\n${text.slice(0, 500)}\n\n`;
        errorDetail += `※ ローカルサーバー(localhost)に接続しようとしてGoogleのプロキシエラーが発生しているか、ngrokの警告画面が表示されている可能性があります。\n`;
        errorDetail += `※ GAS内の baseUrl (現在の値: "${baseUrl}") が正しい接続先ドメインになっているか確認してください。`;
        ui.alert('❌ レスポンス解析エラー (HTTP 200)', errorDetail, ui.ButtonSet.OK);
        return;
      }

      if (result.success) {
        let successMsg = `✅ YOYAKL への同期が成功しました！\n出勤: ${result.shifts_count} 件\n予約: ${result.reservations_count} 件`;
        if (logs.length > 0) {
          successMsg += `\n\n【デバッグログ】\n` + logs.slice(0, 10).join('\n');
          if (logs.length > 10) successMsg += '\n...他多数';
        }
        ui.alert('✅ 同期完了', successMsg, ui.ButtonSet.OK);
      } else {
        ui.alert('❌ 同期失敗', `エラーが発生しました:\n${result.error || text}\n\n【デバッグログ】\n` + logs.join('\n'), ui.ButtonSet.OK);
      }
    } else {
      // 500 や 404 などの HTML エラー時
      let errorDetail = `サーバーでエラーが発生しました (HTTP ${code})。\n\n`;
      errorDetail += `■ 返ってきた内容 (先頭500文字):\n${text.slice(0, 500)}\n\n`;
      errorDetail += `※ APIサーバーで例外が発生したか、またはルーティングが存在しない可能性があります。\n`;
      errorDetail += `※ GAS内の baseUrl (現在の値: "${baseUrl}") および APIサーバーのデプロ状況を確認してください。`;
      ui.alert('❌ 同期失敗 (HTTP ' + code + ')', errorDetail, ui.ButtonSet.OK);
    }
  } catch (err) {
    ui.alert('❌ 通信エラー', `サーバーとの通信に失敗しました:\n${String(err)}\n\n【デバッグログ】\n` + logs.join('\n'), ui.ButtonSet.OK);
  }
}


