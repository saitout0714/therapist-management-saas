// =============================================
// YOYAKL 同期専用スクリプト (YoyaklSync.gs)
// =============================================

// 同期対象店舗の簡易設定（グローバル変数の衝突を避けるため、独自の定数名を使用します）
const YOYAKL_SHOP_CONFIG = {
  "shop_cocoro_oyama": {
    "name": "こころリンス大山",
    "sheetName": "大山",
    "supabaseShopId": "a0000001-0000-0000-0000-000000000004"
  },
  "shop_cocoro_asakusabashi": {
    "name": "こころリンス浅草橋",
    "sheetName": "ﾘﾝｽ",
    "supabaseShopId": "dc3caa06-fcc2-4bdc-b063-7969296efd34"
  },
  "shop_queenterrace": {
    "name": "クイーンテラス",
    "sheetName": "ﾃﾗｽ",
    "supabaseShopId": "960d84c5-d1cd-44bc-a39a-85f8ecc3d51a"
  },
  "shop_rosecafe": {
    "name": "ローズカフェ",
    "sheetName": "ﾛｰｽﾞｶﾌｪ",
    "supabaseShopId": "a0000001-0000-0000-0000-000000000005"
  },
  "shop_shukujyo": {
    "name": "淑女の秘密スパ",
    "sheetName": "淑女", // ⚠️ 淑女の秘密スパのシート（タブ）名に合わせて変更してください
    "supabaseShopId": "3464ed8c-44e8-46f1-b701-9b6ae0f465a8"
  }
};

// スプレッドシートメニューに同期ボタンを追加
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔄 YOYAKL同期(v2)')
    .addItem('YOYAKLへデータを出力（同期）', 'exportDataToYoyakl')
    .addToUi();
}

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
function parseReservationCell(text, defaultStart, defaultEnd, defaultDuration, phoneDigitLength) {
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
  let customerName = '';
  let phoneSuffix = '';
  let designation = 'free';

  // 桁数のデフォルトは4桁
  phoneDigitLength = phoneDigitLength || 4;

  if (customerLine) {
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

    // 指名区分の判定対象文字列を作成（2行目と3行目の1行目を結合）
    let designationTarget = customerLine;
    if (memoLines.length > 0) {
      designationTarget += '\n' + memoLines[0];
    }
    const cleanDesignationTarget = designationTarget.toLowerCase();

    // 指名区分の判定
    const isConfirmed = ['b', 'ｂ', '本', '本指名', 'ほん', 'ほん指名'].some(k => cleanDesignationTarget.indexOf(k) !== -1);
    const isFirstNomination = ['s', 'ｓ', '新', '新指', '新規', '初回', '初回指名'].some(k => cleanDesignationTarget.indexOf(k) !== -1);
    const isNomination = ['指', '指名', 'しめい'].some(k => cleanDesignationTarget.indexOf(k) !== -1);
    const isPrincess = ['姫', '姫予約', 'ひめ'].some(k => cleanDesignationTarget.indexOf(k) !== -1);

    if (isConfirmed) {
      designation = 'confirmed';
    } else if (isFirstNomination) {
      designation = 'first_nomination';
    } else if (isNomination) {
      designation = 'nomination';
    } else if (isPrincess) {
      designation = 'princess';
    }

    // 1. 指定桁数の数字（4桁または5桁）の抽出（顧客名からは除去せず残す）
    const digitRegex = new RegExp('\\d{' + phoneDigitLength + '}');
    const phoneMatch = customerLine.match(digitRegex);
    if (phoneMatch) {
      phoneSuffix = phoneMatch[0];
    }

    // 2. 指名記号、区分ワード、カッコ、スペースなどのゴミを徹底的に排除
    customerName = customerLine
      .replace(/[bBsSｂｂｓｓ]/g, '') // 全角のｂ, ｓも追加
      .replace(/[（\(\)）]/g, '')
      .replace(/(ご?新規|初回|本指名|指名|フリー|会員|様)/g, '')
      .replace(/[本指姫新]/g, '')
      .replace(/[\s　]+/g, '') // スペースも完全に除去
      .trim();

    if (!customerName) {
      return null; // 名前部分が空になったら無効な予約としてスキップ
    }
  } else {
    return null; // 顧客名セルが空欄の場合は無効な予約としてスキップ
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

  let shopKey = null;
  for (const key in YOYAKL_SHOP_CONFIG) {
    if (YOYAKL_SHOP_CONFIG[key].sheetName === sheetName) {
      shopKey = key;
      break;
    }
  }

  if (!shopKey) {
    ui.alert('❌ 現在アクティブなシート「' + sheetName + '」はYOYAKL同期設定に登録されていません。\nYOYAKL_SHOP_CONFIG の sheetName と一致しているか確認してください。');
    return;
  }

  const config = YOYAKL_SHOP_CONFIG[shopKey];
  
  const response = ui.alert(
    '🔄 同期確認',
    `店舗「${config.name}」のデータを YOYAKL に直接出力（同期）します。\nよろしいですか？`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  const maxCols = sheet.getLastColumn();
  const maxRows = sheet.getLastRow();
  if (maxCols === 0 || maxRows === 0) {
    ui.alert('❌ シートにデータがありません。');
    return;
  }

  const mergedRanges = sheet.getDataRange().getMergedRanges();
  const mergeMap = new Map();
  for (const r of mergedRanges) {
    const startRow = r.getRow();
    const startCol = r.getColumn();
    const endRow = r.getLastRow();
    mergeMap.set(`${startRow}_${startCol}`, {
      startRow: startRow,
      endRow: endRow
    });
  }

  const values = sheet.getRange(1, 1, maxRows, maxCols).getDisplayValues();

  const shifts = [];
  const reservations = [];
  const dateSet = new Set();
  const logs = [];

  logs.push(`開始: 列数=${maxCols}, 行数=${maxRows}, 結合セル数=${mergedRanges.length}`);

  for (let colIdx = 4; colIdx < maxCols; colIdx++) {
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

    const staffVal = values[3][colIdx];
    if (!staffVal) continue;

    const staffName = staffVal.trim().replace(/\d+(精算)?$/, '');
    const roomName = values[4][colIdx] ? values[4][colIdx].trim() : '';

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

    shifts.push({
      date: dateStr,
      therapist_name: staffName,
      room_name: roomName,
      start_time: startTime,
      end_time: endTime
    });

    dateSet.add(dateStr);

    // 会員番号の桁数を決定 (クイーンテラスとローズカフェは5桁、その他は4桁)
    let phoneDigitLength = 4;
    if (shopKey === 'shop_queenterrace' || shopKey === 'shop_rosecafe' || sheetName === 'ﾃﾗｽ' || sheetName === 'ﾛｰｽﾞｶﾌｪ') {
      phoneDigitLength = 5;
    }

    let colResCount = 0;
    let rowIdx = 6;
    while (rowIdx < maxRows) {
      const cellText = values[rowIdx][colIdx] ? values[rowIdx][colIdx].trim() : "";
      if (cellText === "") {
        rowIdx++;
        continue;
      }

      // 時間表記（例: 1200-1330, 12:00-13:30 など）にマッチするか
      const timeRegex = /(\d{1,2})[：:]?(\d{2})[\s\-〜~ー]+(\d{1,2})[：:]?(\d{2})/;
      const timeMatch = cellText.match(timeRegex);

      if (timeMatch) {
        const startH = timeMatch[1].padStart(2, '0');
        const startM = timeMatch[2];
        const endH = timeMatch[3].padStart(2, '0');
        const endM = timeMatch[4];
        const startTime = `${startH}:${startM}`;
        const endTime = `${endH}:${endM}`;

        const startMin = hmToMinutesAllowing24Plus(startTime);
        const endMin = hmToMinutesAllowing24Plus(endTime);
        const duration = (startMin != null && endMin != null) ? (endMin - startMin) : 60; // デフォルト60分

        // 顧客名とメモの取得先を判定（非結合セルの縦並びに対応）
        let targetText = cellText;
        const cellLines = cellText.split('\n').map(l => l.trim()).filter(l => l !== '');
        
        if (cellLines.length > 1) {
          // すでにセル内に複数行（改行区切り）で情報が入っている場合
        } else {
          // 非結合セルで、下の行に顧客名や指名区分がバラバラに入っている場合
          // 予約時間（duration）に対応するステップ数の範囲で、次の時間表記が現れる前までのセルをマージする
          const lines = [cellText];
          const steps = Math.max(1, Math.floor(duration / 10));
          
          for (let offset = 1; offset < steps; offset++) {
            if (rowIdx + offset >= maxRows) break;
            const nextCellText = values[rowIdx + offset][colIdx] ? values[rowIdx + offset][colIdx].trim() : "";
            
            // 途中で別の時間表記が現れたら、それは別の予約なのでマージをストップする
            if (nextCellText.match(timeRegex)) {
              break;
            }
            if (nextCellText !== "") {
              lines.push(nextCellText);
            }
          }
          targetText = lines.join('\n');
        }

        // 3行目の値が、指名区分ではない無関係な文字列（例: メモ書き等）なら無視する
        const targetLines = targetText.split('\n').map(l => l.trim()).filter(l => l !== '');
        let isInvalid = false;
        
        if (targetLines.length >= 3) {
          const line3 = targetLines[2].toLowerCase();
          // 3文字以下の短い文字列は、指名記号 (k, p, も 等) や略称とみなしてスキップ判定を行わない
          if (line3.length > 3) {
            const validKeywords = [
              '本', '本指名', 'ほん', 'ほん指名', 'b', 'ｂ',
              '指', '指名', 'しめい',
              '新', '新指', '新規', '初回', '初回指名', 's', 'ｓ',
              'フリー', 'ふりー', 'free', 'f', 'ｆ',
              '姫', '姫予約', 'ひめ'
            ];
            const isDesignation = validKeywords.some(keyword => line3.indexOf(keyword) !== -1);
            if (!isDesignation) {
              isInvalid = true; // 4文字以上でキーワードがないものだけを無効と判定
            }
          }
        }

        if (!isInvalid) {
          const parsedRes = parseReservationCell(targetText, startTime, endTime, duration, phoneDigitLength);
          if (parsedRes) {
            reservations.push({
              date: dateStr,
              therapist_name: staffName,
              customer_name: parsedRes.customerName,
              phone_suffix: parsedRes.phoneSuffix || undefined,
              start_time: startTime,
              end_time: endTime,
              duration: duration,
              designation_type: parsedRes.designation || 'free',
              notes: parsedRes.notes || targetText
            });
            colResCount++;
          } else {
            if (targetText.match(/\d+/) && targetText.length < 20) {
              logs.push(`[列 ${colIdx + 1} / 行 ${rowIdx + 1}] 予約パース失敗: "${targetText.replace(/\n/g, ' ')}"`);
            }
          }
        }

        // 次のスキャン位置へジャンプ（予約のコマ数分だけ進める）
        const steps = Math.max(1, Math.floor(duration / 10));
        rowIdx += steps;
      } else {
        // 時間表記がないセルは、予約の開始ではないためスキップ
        rowIdx++;
      }
    }
    if (colResCount > 0) {
      logs.push(`[列 ${colIdx + 1}] ${staffName} の予約を ${colResCount} 件抽出`);
    }
  }

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
  const baseUrl = 'https://yoyakl.tokyo/';
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBaseUrl}/api/sync-from-spreadsheet`;

  // 日付の配列を取得し、昇順にソート
  const dateList = Array.from(dateSet).sort();
  let totalShiftsSynced = 0;
  let totalReservationsSynced = 0;

  SpreadsheetApp.getActiveSpreadsheet().toast('同期処理を開始します...', '🔄 YOYAKL同期', 5);

  for (let i = 0; i < dateList.length; i++) {
    const targetDate = dateList[i];
    
    // その日のデータを抽出
    const dayShifts = shifts.filter(s => s.date === targetDate);
    const dayReservations = reservations.filter(r => r.date === targetDate);

    // トーストで進捗をリアルタイム表示
    const progressMsg = `[${i + 1}/${dateList.length}日] ${targetDate} を同期中 (出勤: ${dayShifts.length}件, 予約: ${dayReservations.length}件)...`;
    SpreadsheetApp.getActiveSpreadsheet().toast(progressMsg, '🔄 YOYAKL同期中', 15);
    SpreadsheetApp.flush();

    const payload = {
      token: token,
      shopId: config.supabaseShopId,
      dates: [targetDate], // 1日分のみ送信
      shifts: dayShifts,
      reservations: dayReservations
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
          let errorDetail = `【${targetDate} の同期中にエラー】\n`;
          errorDetail += `サーバーから正常応答(200 OK)を受け取りましたが、データ形式が不正です(JSONではありません)。\n\n`;
          errorDetail += `■ 返ってきた内容 (先頭500文字):\n${text.slice(0, 500)}\n\n`;
          errorDetail += `※ GAS内の baseUrl (現在の値: "${baseUrl}") が正しい接続先ドメインになっているか確認してください。`;
          ui.alert(`❌ レスポンス解析エラー (HTTP 200) - ${targetDate}`, errorDetail, ui.ButtonSet.OK);
          return;
        }

        if (result.success) {
          totalShiftsSynced += result.shifts_count || 0;
          totalReservationsSynced += result.reservations_count || 0;
        } else {
          let errDetail = `【${targetDate} の同期中にエラー】\n`;
          errDetail += `エラーが発生しました:\n${result.error || text}\n\n`;
          ui.alert(`❌ 同期失敗 - ${targetDate}`, errDetail, ui.ButtonSet.OK);
          return;
        }
      } else {
        let errorDetail = `【${targetDate} の同期中にエラー】\n`;
        errorDetail += `サーバーでエラーが発生しました (HTTP ${code})。\n\n`;
        errorDetail += `■ 返ってきた内容 (先頭500文字):\n${text.slice(0, 500)}\n\n`;
        errorDetail += `※ APIサーバーで例外が発生したか、またはルーティングが存在しない可能性があります。\n`;
        errorDetail += `※ GAS内の baseUrl (現在の値: "${baseUrl}") および APIサーバーのデプロイ状況を確認してください。`;
        ui.alert(`❌ 同期失敗 (HTTP ${code}) - ${targetDate}`, errorDetail, ui.ButtonSet.OK);
        return;
      }
    } catch (err) {
      ui.alert(`❌ 通信エラー - ${targetDate}`, `【${targetDate} の同期中に通信エラーが発生しました】\n${String(err)}`, ui.ButtonSet.OK);
      return;
    }
  }

  let successMsg = `✅ YOYAKL へのすべての同期が成功しました！\n対象日程数: ${dateList.length} 日間\n総出勤数: ${totalShiftsSynced} 件\n総予約数: ${totalReservationsSynced} 件`;
  if (logs.length > 0) {
    successMsg += `\n\n【デバッグログ】\n` + logs.slice(0, 10).join('\n');
    if (logs.length > 10) successMsg += '\n...他多数';
  }
  ui.alert('✅ 同期完了', successMsg, ui.ButtonSet.OK);
}
