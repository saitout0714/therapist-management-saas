/**
 * Googleカレンダー → Supabase 予約インポートスクリプト
 *
 * ■ 手動実行手順
 *   1. GASエディタ左メニュー「プロジェクトの設定」>「スクリプト プロパティ」に
 *      プロパティ名: SUPABASE_SERVICE_ROLE_KEY
 *      値: Supabase の Service Role Key
 *      を登録する
 *   2. 下の importCalendarToSupabase() 内の startDate / endDate を設定する
 *   3. 関数名 importCalendarToSupabase を選んで「実行（▶）」
 *   4. 実行ログでインポート結果を確認する
 *
 * ■ ウェブアプリとして利用する場合
 *   1. [デプロイ] > [新しいデプロイ] > 種類: ウェブアプリ
 *   2. 次のユーザーとして実行: 自分
 *   3. アクセスできるユーザー: 全員（または自分のみ）
 *   4. デプロイ後に表示されるURLを NEXT_PUBLIC_GAS_IMPORT_URL に設定する
 *
 * ■ イベントタイトル形式
 *   {セラピスト名}さん{お客様名}様{施術時間}分{指名種別}
 *   例: リナさん田中様90分本指名 / アオイさん佐藤様60分フリー
 */

// ===== 設定 =====
var SUPABASE_URL = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
var SHOP_ID      = '1faab510-3c7e-4a01-9ce6-d3b93bbdad81';
var CALENDAR_ID  = 'yokkaichicrystalspa@gmail.com';

function getServiceRoleKey() {
  var key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('スクリプトプロパティに SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  return key;
}

// ===== 手動実行エントリポイント =====
function importCalendarToSupabase() {
  // ★ 対象期間を変更してください
  var startDate = new Date('2024-12-01T00:00:00+09:00');
  var endDate   = new Date('2026-04-27T23:59:59+09:00');

  var result = runImport(startDate, endDate);

  Logger.log('====== インポート完了 ======');
  Logger.log('成功:          ' + result.imported + ' 件');
  Logger.log('スキップ(重複): ' + result.skipped  + ' 件');
  Logger.log('エラー:         ' + result.errors   + ' 件');
  Logger.log('');
  Logger.log('=== 詳細ログ ===');
  result.log.forEach(function(line) { Logger.log(line); });
}

// ===== ウェブアプリ エントリポイント (POST) =====
function doPost(e) {
  try {
    var params    = JSON.parse(e.postData.contents);
    var startDate = new Date((params.startDate || '2024-01-01') + 'T00:00:00+09:00');
    var endDate   = new Date((params.endDate   || '2025-12-31') + 'T23:59:59+09:00');
    var result    = runImport(startDate, endDate);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, result: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== ウェブアプリ エントリポイント (GET) =====
function doGet(e) {
  try {
    var startDate = new Date((e.parameter.startDate || '2024-01-01') + 'T00:00:00+09:00');
    var endDate   = new Date((e.parameter.endDate   || '2025-12-31') + 'T23:59:59+09:00');
    var result    = runImport(startDate, endDate);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, result: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== コアインポートロジック =====
function runImport(startDate, endDate) {
  var log      = [];
  var imported = 0;
  var skipped  = 0;
  var errors   = 0;
  var key;

  try {
    key = getServiceRoleKey();
  } catch (err) {
    return { imported: 0, skipped: 0, errors: 1, log: [String(err)] };
  }

  // セラピスト一覧取得
  var therapists;
  try {
    therapists = fetchTherapists(key);
    log.push('[準備] セラピスト ' + therapists.length + ' 人取得');
  } catch (err) {
    return { imported: 0, skipped: 0, errors: 1, log: ['セラピスト取得失敗: ' + String(err)] };
  }

  // 指名種別マップ取得（slug → id）
  var designationTypeMap;
  try {
    designationTypeMap = fetchDesignationTypeMap(key);
    log.push('[準備] 指名種別 ' + Object.keys(designationTypeMap).length + ' 種取得');
  } catch (err) {
    log.push('[警告] 指名種別取得失敗（designation_type_id は null で登録します）: ' + String(err));
    designationTypeMap = {};
  }

  // Googleカレンダーイベント取得
  var calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!calendar) {
    return { imported: 0, skipped: 0, errors: 1, log: ['カレンダーが見つかりません: ' + CALENDAR_ID] };
  }
  var events = calendar.getEvents(startDate, endDate);
  log.push('[準備] イベント ' + events.length + ' 件取得 (' +
    formatDate(startDate) + ' 〜 ' + formatDate(endDate) + ')');

  // 顧客名 → ID のキャッシュ（同一顧客の重複API呼び出しを防ぐ）
  var customerCache = {};

  // タイムアウト対策：5分で自動停止（残りは次回実行で続きから処理）
  var startMs = new Date().getTime();
  var MAX_MS  = 5 * 60 * 1000;

  for (var i = 0; i < events.length; i++) {
    if (new Date().getTime() - startMs > MAX_MS) {
      log.push('[中断] 実行時間5分に達しました。残り ' + (events.length - i) + ' 件未処理。' +
        '再実行すると処理済みをスキップして続きから処理されます。');
      break;
    }

    var event = events[i];
    var title = event.getTitle();

    // タイトルパース
    var parsed = parseEventTitle(title);
    if (!parsed) {
      log.push('[スキップ] パース不可: "' + title + '"');
      skipped++;
      continue;
    }

    // セラピスト検索
    var therapist = findTherapistByName(therapists, parsed.therapistName);
    if (!therapist) {
      log.push('[スキップ] セラピスト未登録: "' + parsed.therapistName + '" / タイトル: "' + title + '"');
      skipped++;
      continue;
    }

    // 日時
    var eventStart   = event.getStartTime();
    var eventEnd     = event.getEndTime();
    var dateStr      = formatDate(eventStart);
    var startTimeStr = formatTime(eventStart);
    var endTimeStr   = formatTime(eventEnd);

    // 重複チェック（同日・同開始時刻・同セラピスト）
    var isDuplicate;
    try {
      isDuplicate = checkDuplicateReservation(key, dateStr, startTimeStr, therapist.id);
    } catch (err) {
      log.push('[エラー] 重複チェック失敗: ' + dateStr + ' ' + startTimeStr + ' / ' + String(err));
      errors++;
      continue;
    }
    if (isDuplicate) {
      log.push('[スキップ(重複)] ' + dateStr + ' ' + startTimeStr + ' ' + parsed.therapistName + ' / ' + parsed.customerName + '様');
      skipped++;
      continue;
    }

    // 顧客 取得または作成
    var customerId;
    try {
      if (customerCache[parsed.customerName]) {
        customerId = customerCache[parsed.customerName];
      } else {
        customerId = findOrCreateCustomer(key, parsed.customerName);
        customerCache[parsed.customerName] = customerId;
      }
    } catch (err) {
      log.push('[エラー] 顧客取得/作成失敗: "' + parsed.customerName + '" / ' + String(err));
      errors++;
      continue;
    }

    // 指名種別
    var designationSlug   = mapDesignationType(parsed.designationType);
    var designationTypeId = designationTypeMap[designationSlug] || null;

    // 予約登録
    try {
      insertReservation(key, {
        shop_id:             SHOP_ID,
        therapist_id:        therapist.id,
        customer_id:         customerId,
        date:                dateStr,
        start_time:          startTimeStr,
        end_time:            endTimeStr,
        status:              'completed',
        designation_type:    designationSlug,
        designation_type_id: designationTypeId,
        total_price:         0,
        notes:               'Googleカレンダーよりインポート',
      });
      log.push('[成功] ' + dateStr + ' ' + startTimeStr + '〜' + endTimeStr +
        ' ' + parsed.therapistName + ' / ' + parsed.customerName + '様 (' + designationSlug + ')');
      imported++;
    } catch (err) {
      log.push('[エラー] 予約登録失敗: ' + dateStr + ' ' + startTimeStr +
        ' ' + parsed.therapistName + ' / ' + String(err));
      errors++;
    }
  }

  return { imported: imported, skipped: skipped, errors: errors, log: log };
}

// ===== タイトルパース =====
// 形式: {セラピスト名}さん{お客様名}様{施術時間}分{指名種別}
function parseEventTitle(title) {
  var match = title.match(/^(.+?)さん(.+?)様(\d+)分(.*)$/);
  if (!match) return null;
  return {
    therapistName:   match[1].trim(),
    customerName:    match[2].trim(),
    duration:        parseInt(match[3], 10),
    designationType: match[4].trim(),
  };
}

// ===== 指名種別テキスト → DBスラッグ変換 =====
function mapDesignationType(text) {
  if (!text)                       return 'free';
  if (text.indexOf('本指名') >= 0)  return 'confirmed';
  if (text.indexOf('初回指名') >= 0) return 'first_nomination';
  if (text.indexOf('フリー') >= 0)   return 'free';
  if (text.indexOf('指名') >= 0)     return 'first_nomination';
  return 'free';
}

// ===== セラピスト名前検索（前後空白・全半角を考慮）=====
function findTherapistByName(therapists, name) {
  var normalized = name.trim();
  for (var i = 0; i < therapists.length; i++) {
    if (therapists[i].name.trim() === normalized) return therapists[i];
  }
  return null;
}

// ===== 日時フォーマット（JST）=====
function formatDate(date) {
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function formatTime(date) {
  return Utilities.formatDate(date, 'Asia/Tokyo', 'HH:mm:ss');
}

// ===== Supabase REST APIラッパー =====
function supabaseRequest(key, method, path, body) {
  var options = {
    method:             method,
    headers: {
      'apikey':         key,
      'Authorization':  'Bearer ' + key,
      'Content-Type':   'application/json',
      'Prefer':         'return=representation',
    },
    muteHttpExceptions: true,
  };
  if (body) options.payload = JSON.stringify(body);

  var response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1' + path, options);
  var code     = response.getResponseCode();
  var text     = response.getContentText();

  if (code >= 400) {
    throw new Error('HTTP ' + code + ': ' + text.slice(0, 300));
  }
  return text ? JSON.parse(text) : null;
}

function fetchTherapists(key) {
  return supabaseRequest(
    key, 'GET',
    '/therapists?shop_id=eq.' + SHOP_ID + '&is_active=eq.true&select=id,name&order=name'
  ) || [];
}

function fetchDesignationTypeMap(key) {
  var types = supabaseRequest(
    key, 'GET',
    '/designation_types?shop_id=eq.' + SHOP_ID + '&is_active=eq.true&select=id,slug'
  ) || [];
  var map = {};
  types.forEach(function(t) { map[t.slug] = t.id; });
  return map;
}

function findOrCreateCustomer(key, name) {
  // 名前で既存顧客検索（URLエンコード済みのeqフィルタ）
  var existing = supabaseRequest(
    key, 'GET',
    '/customers?shop_id=eq.' + SHOP_ID +
    '&name=eq.' + encodeURIComponent(name) +
    '&select=id&limit=1'
  );
  if (existing && existing.length > 0) return existing[0].id;

  // 新規顧客作成
  var created = supabaseRequest(key, 'POST', '/customers', {
    name:    name,
    shop_id: SHOP_ID,
  });
  if (!created || !created[0] || !created[0].id) {
    throw new Error('顧客作成レスポンスが不正: ' + JSON.stringify(created));
  }
  return created[0].id;
}

function checkDuplicateReservation(key, date, startTime, therapistId) {
  var result = supabaseRequest(
    key, 'GET',
    '/reservations?shop_id=eq.' + SHOP_ID +
    '&date=eq.' + date +
    '&start_time=eq.' + encodeURIComponent(startTime) +
    '&therapist_id=eq.' + therapistId +
    '&select=id&limit=1'
  );
  return result && result.length > 0;
}

function insertReservation(key, data) {
  supabaseRequest(key, 'POST', '/reservations', data);
}
