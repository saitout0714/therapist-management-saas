// =============================================
// クリスタルシフト・時間順ソート & 2026年強制補正版
// テキスト入力専用（クイーンテラス・レジェンド対応）
// レジェンド特殊並び替え版（武蔵浦和全体を左、その他を右）
// =============================================

const SPREADSHEET_ID = '1ClCKIiPotK9iPgkraz6BcfRsGj5huD9GG0TpSe_zkJk';

const SHOP_CONFIG = {
  'shop_a': {
    name: 'クリスタル',
    sheetName: 'クリスタル',
    supabaseShopId: '1faab510-3c7e-4a01-9ce6-d3b93bbdad81', // YOYAKL上の店舗ID
    rooms: {
      1: { name: 'ルーム①205', color: '#00FFFF' },
      2: { name: 'ルーム②307', color: '#FFFF00' },
      3: { name: 'ルーム③202', color: '#00FF00' },
      4: { name: 'ルーム④301', color: '#FF9900' }
    },
    staffList: ['すい', 'いちか', 'そら']
  },
  'shop_b': {
    name: '裏妻',
    sheetName: '裏妻',
    supabaseShopId: 'da3ac7a8-e84d-4dbd-830c-81e9e8b6631a', // YOYAKL上の店舗ID
    rooms: {
      1: { name: 'ルームA 201', color: '#D9EAD3' },
      2: { name: 'ルームB 207', color: '#FFE599' },
      3: { name: 'ルームC 901', color: '#F4CCCC' },
      4: { name: 'ルームD 201', color: '#a4c2f4' }
    },
    staffList: [
      'あかね', 'みずき', 'みさき', 'まりん',
      'ゆきの', 'あい', 'みなみ', 'ゆい', 'えま',
      'らん', 'りな', 'なな'
    ]
  },
  'shop_c': {
    name: 'クイーンテラス',
    sheetName: 'クイーンテラス',
    supabaseShopId: '960d84c5-d1cd-44bc-a39a-85f8ecc3d51a', // YOYAKL上の店舗ID
    rooms: {
      1: { name: '海老名805', color: '#00ffff' },
      2: { name: '大和A101', color: '#00ff00' },
      3: { name: '大和B611', color: '#ff00ff' },
      4: { name: '藤沢A102', color: '#ffff00' },
      5: { name: '藤沢B207', color: '#ff9900' }
    },
    staffList: [
      '蒼井', '鈴木', '結城', '白石', '天使',
      '泉', '高橋', '三上', '相馬', '高梨', '森川'
    ]
  },
  'shop_d': {
    name: 'レジェンド',
    sheetName: 'レジェンド',
    supabaseShopId: 'YOUR_LEGEND_SUPABASE_SHOP_ID', // YOYAKL上の店舗ID（発行後に入力）
    rooms: {
      1: { name: 'ひばり305🅰️', color: '#00ffff' },
      2: { name: 'ひばり305🅱️', color: '#00ffff' },
      3: { name: '三鷹302', color: '#ffff00' },
      4: { name: '府中504', color: '#ff00ff' },
      5: { name: '武蔵浦和308', color: '#00ff00' }
    },
    staffList: [
      '黒名ゆい', '氷川しろ', '心美まや', '柏木ひな', '柴咲あみ',
      '北川ゆず', '結乃りあ', '羽澄ありさ', '神崎るな', '星野あいり',
      '天野うた', '西園寺ひめか', '藤崎かな'
    ]
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📅 シフト管理')
    .addItem('テキストからシフト追加', 'showSidebar')
    .addItem('YOYAKLからシフトを同期', 'showSyncDialog')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('📅 シフト追加')
    .setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showSyncDialog() {
  const html = HtmlService.createHtmlOutputFromFile('SyncDialog')
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
    let roomId = null;
    for (const key in config.rooms) {
      if (config.rooms[key].name === s.room_name) {
        roomId = key;
        break;
      }
    }

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
以下の「${config.name}」のシフトテキストを解析してください。

【シフトテキスト】
${shiftText}

【絶対厳守の命令】
1. すべてのスタッフのシフトを1件残らず抽出してください。省略禁止です。
2. スタッフ名は「名前＋インターバル数字」の形式（例: 白石ななせ20、鈴木えま20）を保持してください。苗字だけや名前のみに加工せず、入力された通りのフルネーム＋数字で出力してください。
3. 日付は「必ず2026年」として扱ってください。出力は必ず 2026-MM-DD 形式にしてください。
4. 深夜時間（25:00等や、翌2時を表す「18-2」の「2」等）は、「2500」「0200」のように4桁の数字として抽出してください。
5. エリア名とルーム名が記載されている場合は、それらを組み合わせて該当するルーム番号を正しく判定してください。

スタッフ候補: ${config.staffList.join(', ')}

出力形式:
1. ルームのマッピング: ${Object.keys(config.rooms).map(k => config.rooms[k].name + 'は' + k).join(', ')}。
2. JSON配列形式のみ出力。
[{"date":"2026-MM-DD", "room":数値, "staff":"フルネーム（数字含む）", "start":"HHMM", "end":"HHMM"}]
`;

  const payload = {
    "contents": [{
      "parts": [{ "text": prompt }]
    }],
    "generationConfig": {
      "temperature": 0.0,
      "maxOutputTokens": 8192
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
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('JSON抽出失敗: ' + text);

  let shifts = JSON.parse(match[0]);
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  const room = roomConfig[shift.room];
  if (!room) return;

  const row1Range = sheet.getRange(1, colIndex);
  const dateObj = new Date(shift.date.replace(/-/g, '/'));
  row1Range.setValue(dateObj);
  row1Range.setNumberFormat('M月D日(aaa)');

  sheet.getRange(4, colIndex).setValue(shift.staff);
  const row5 = sheet.getRange(5, colIndex);
  row5.setValue(room.name).setBackground(room.color);
 
  sheet.getRange(6, colIndex).setValue(shift.start + '-' + shift.end);
  sheet.getRange(1, colIndex, 6, 1).setHorizontalAlignment('center');
}
