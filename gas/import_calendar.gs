/**
 * Googleカレンダー → Supabase 予約インポートスクリプト（v4）
 *
 * urlfetch最小化戦略:
 *   - セラピスト一覧: 1回
 *   - 指名種別マップ: 1回
 *   - 既存予約: 1〜数回（1000件ページング）
 *   - 既存顧客: 1〜数回（1000件ページング）← NEW
 *   - 新規顧客作成: 新規顧客の数だけ
 *   - 予約登録: 成功件数だけ
 *   → 重複チェック・顧客検索はAPIコールなし（メモリ上）
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
  var startDate = new Date('2026-05-01T00:00:00+09:00');
  var endDate   = new Date('2026-07-31T23:59:59+09:00');

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

  // ===== 準備フェーズ（API呼び出しをまとめる）=====

  // 1. セラピスト一覧（1回）
  var therapists;
  try {
    therapists = fetchTherapists(key);
    log.push('[準備] セラピスト ' + therapists.length + ' 人取得');
  } catch (err) {
    return { imported: 0, skipped: 0, errors: 1, log: ['セラピスト取得失敗: ' + String(err)] };
  }

  // 2. 指名種別マップ（1回）
  var designationTypeMap = {};
  try {
    designationTypeMap = fetchDesignationTypeMap(key);
    log.push('[準備] 指名種別 ' + Object.keys(designationTypeMap).length + ' 種取得');
  } catch (err) {
    log.push('[警告] 指名種別取得失敗（null で登録します）: ' + String(err));
  }

  // 3. 既存予約を一括取得（重複チェック用、APIコール数: 件数/1000）
  var existingReservations = {};
  try {
    existingReservations = fetchExistingReservations(key, formatDate(startDate), formatDate(endDate));
    log.push('[準備] 既存予約 ' + Object.keys(existingReservations).length + ' 件取得');
  } catch (err) {
    log.push('[警告] 既存予約取得失敗（重複チェックなしで続行）: ' + String(err));
  }

  // 4. 既存顧客を一括取得（顧客検索をメモリ化、APIコール数: 件数/1000）★NEW
  var customerCache = {};
  try {
    customerCache = fetchAllCustomers(key);
    log.push('[準備] 既存顧客 ' + Object.keys(customerCache).length + ' 件取得');
  } catch (err) {
    log.push('[警告] 既存顧客取得失敗（都度検索にフォールバック）: ' + String(err));
  }

  // 5. コース一覧を取得
  var courseMap = {};
  try {
    courseMap = fetchActiveCoursesMap(key);
    log.push('[準備] コース情報取得完了');
  } catch (err) {
    log.push('[警告] コース情報取得失敗（コース紐付けなしでインポートします）: ' + String(err));
  }

  // 6. カレンダーイベント取得
  var calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!calendar) {
    return { imported: 0, skipped: 0, errors: 1, log: ['カレンダーが見つかりません: ' + CALENDAR_ID] };
  }
  var events = calendar.getEvents(startDate, endDate);
  log.push('[準備] イベント ' + events.length + ' 件取得 (' +
    formatDate(startDate) + ' 〜 ' + formatDate(endDate) + ')');

  // ===== 処理フェーズ =====
  var startMs = new Date().getTime();
  var MAX_MS  = 5 * 60 * 1000;

  for (var i = 0; i < events.length; i++) {
    if (new Date().getTime() - startMs > MAX_MS) {
      log.push('[中断] 実行時間5分に達しました。残り ' + (events.length - i) + ' 件未処理。再実行で続きから処理されます。');
      break;
    }

    var event = events[i];
    var title = event.getTitle();

    // パース
    var parsed = parseEventTitle(title);
    if (!parsed) {
      log.push('[スキップ] パース不可: "' + title + '"');
      skipped++;
      continue;
    }

    // セラピスト検索
    var therapist = findTherapistByName(therapists, parsed.therapistName);
    if (!therapist) {
      log.push('[スキップ] セラピスト未登録: "' + parsed.therapistName + '" / "' + title + '"');
      skipped++;
      continue;
    }

    // 日時
    var eventStart   = event.getStartTime();
    var eventEnd     = event.getEndTime();
    var dateStr      = formatDate(eventStart);
    var startTimeStr = formatTime(eventStart);
    var endTimeStr   = formatTime(eventEnd);

    // 重複チェック（メモリ上、APIコールなし）
    var dupKey = dateStr + '_' + startTimeStr + '_' + therapist.id;
    if (existingReservations[dupKey]) {
      log.push('[スキップ(重複)] ' + dateStr + ' ' + startTimeStr + ' ' + therapist.name + ' / ' + parsed.customerName);
      skipped++;
      continue;
    }

    // 顧客名のs/ｓクレンジング
    var cleanCustName = parsed.customerName.trim();
    var sMatch = cleanCustName.match(/^[sｓ]([^a-zA-Z\s\d].*)$/);
    if (sMatch) {
      cleanCustName = sMatch[1].trim();
    }

    // 顧客ID取得（キャッシュヒット → APIコールなし、新規のみAPIコール）
    var customerId;
    try {
      if (customerCache[cleanCustName]) {
        customerId = customerCache[cleanCustName];
      } else {
        // 新規顧客作成（APIコール1回）
        customerId = createCustomer(key, cleanCustName);
        customerCache[cleanCustName] = customerId;
        log.push('[新規顧客] ' + cleanCustName);
      }
    } catch (err) {
      log.push('[エラー] 顧客作成失敗: "' + cleanCustName + '" / ' + String(err));
      errors++;
      continue;
    }

    // 指名種別
    var designationSlug   = mapDesignationType(parsed.designationType);
    var designationTypeId = designationTypeMap[designationSlug] || null;

    // コース時間の自動判別
    var durationMin = calculateDuration(startTimeStr, endTimeStr);
    var matchedCourse = courseMap[durationMin] || null;

    // 予約登録（APIコール1回）
    try {
      insertReservation(key, {
        shop_id:             SHOP_ID,
        therapist_id:        therapist.id,
        customer_id:         customerId,
        date:                dateStr,
        start_time:          startTimeStr,
        end_time:            endTimeStr,
        status:              'confirmed', // ★ 'completed' から 'confirmed' に変更して表示を可能にする
        designation_type:    designationSlug,
        designation_type_id: designationTypeId,
        course_id:           matchedCourse ? matchedCourse.id : null,
        base_price:          matchedCourse ? matchedCourse.base_price : 0,
        total_price:         matchedCourse ? matchedCourse.base_price : 0,
        customer_notified:   true,
        therapist_notified:  true,
        notes:               'Googleカレンダーよりインポート',
      });

      existingReservations[dupKey] = true; // 同一実行内の重複防止
      log.push('[成功] ' + dateStr + ' ' + startTimeStr + '〜' + endTimeStr +
        ' ' + therapist.name + ' / ' + cleanCustName + ' (' + designationSlug + ')');
      imported++;
    } catch (err) {
      log.push('[エラー] 予約登録失敗: ' + dateStr + ' ' + startTimeStr +
        ' ' + therapist.name + ' / ' + String(err));
      errors++;
    }
  }

  return { imported: imported, skipped: skipped, errors: errors, log: log };
}

// ===== 既存予約を一括取得 =====
function fetchExistingReservations(key, startDate, endDate) {
  var map    = {};
  var limit  = 1000;
  var offset = 0;
  while (true) {
    var rows = supabaseRequest(key, 'GET',
      '/reservations?shop_id=eq.' + SHOP_ID +
      '&date=gte.' + startDate + '&date=lte.' + endDate +
      '&select=date,start_time,therapist_id' +
      '&limit=' + limit + '&offset=' + offset
    ) || [];
    rows.forEach(function(r) {
      // 秒部分を切り落として HH:mm 形式に標準化
      var normTime = r.start_time ? r.start_time.substring(0, 5) : '';
      map[r.date + '_' + normTime + '_' + r.therapist_id] = true;
    });
    if (rows.length < limit) break;
    offset += limit;
  }
  return map;
}

// ===== 既存顧客を全件一括取得（名前→IDのマップ）★NEW =====
function fetchAllCustomers(key) {
  var map    = {};
  var limit  = 1000;
  var offset = 0;
  while (true) {
    var rows = supabaseRequest(key, 'GET',
      '/customers?shop_id=eq.' + SHOP_ID +
      '&select=id,name' +
      '&limit=' + limit + '&offset=' + offset
    ) || [];
    rows.forEach(function(r) {
      map[r.name] = r.id;
    });
    if (rows.length < limit) break;
    offset += limit;
  }
  return map;
}

// ===== 新規顧客作成のみ（検索は不要、キャッシュで済む）=====
function createCustomer(key, name) {
  var created = supabaseRequest(key, 'POST', '/customers', {
    name:    name,
    shop_id: SHOP_ID,
  });
  if (!created || !created[0] || !created[0].id) {
    throw new Error('顧客作成レスポンスが不正: ' + JSON.stringify(created));
  }
  return created[0].id;
}

// ===== タイトルパース =====
function parseEventTitle(title) {
  // Step1: 先頭ノイズ除去（「姫予約」も追加）
  var cleaned = title
    .replace(/^[\s✅🆑🆕⚠️※]+/, '')
    .replace(/^(キャンセル|セラピスト都合|姫予約)\s*/, '')
    .replace(/^\d{1,2}:\d{2}[〜~]\d{0,2}:?\d{0,2}\s*/, '')
    .replace(/^\d{1,2}:\d{2}[〜~]\s*/, '');

  // 追加: セラピスト名の末尾につく「15」「20」「30精算」などを除去するヘルパー
  function cleanTherapistName(name) {
    return name.trim().replace(/\d+(精算)?$/, '');
  }

  // パターンA: 「さん〜様〜分」標準形式
  var matchA = cleaned.match(
    /^(.+?)さん\s*(新規|ご新規|会員|人気)?\s*(.+?)様\s*.*?(\d+)分(.*)$/
  );
  if (matchA) {
    var customerA = matchA[3].trim().replace(/^(新規|ご新規|会員|人気)\s*/, '');
    return {
      therapistName:   cleanTherapistName(matchA[1]), // ★クリーニング適用
      customerName:    customerA,
      duration:        parseInt(matchA[4], 10),
      designationType: matchA[5].trim(),
    };
  }

  // パターンB: 「さん」「様」なしスペース区切り
  var matchB = cleaned.match(
    /^(.+?)\s+(新規|ご新規|会員)?\s*([^\s]+?\d{4})\s+.*?(\d+)分?(.*)$/
  );
  if (matchB) {
    var customerB = matchB[3].trim().replace(/^(新規|ご新規|会員)\s*/, '');
    return {
      therapistName:   cleanTherapistName(matchB[1]), // ★クリーニング適用
      customerName:    customerB,
      duration:        parseInt(matchB[4], 10),
      designationType: matchB[5].trim(),
    };
  }

  // パターンC: 会員番号と分数が連結
  var matchC = cleaned.match(
    /^(.+?)さん\s*(新規|ご新規|会員)?\s*([^\s]+?\d{3,4})(\d+)分(.*)$/
  );
  if (matchC) {
    var customerC = matchC[3].trim().replace(/^(新規|ご新規|会員)\s*/, '');
    return {
      therapistName:   cleanTherapistName(matchC[1]), // ★クリーニング適用
      customerName:    customerC,
      duration:        parseInt(matchC[4], 10),
      designationType: matchC[5].trim(),
    };
  }

  return null;
}

// ===== 指名種別変換 =====
function mapDesignationType(text) {
  if (!text)                         return 'free';
  if (text.indexOf('本指名') >= 0)   return 'confirmed';
  if (text.indexOf('ほん指名') >= 0) return 'confirmed';
  if (text.indexOf('初回指名') >= 0) return 'first_nomination';
  if (text.indexOf('フリー') >= 0)   return 'free';
  if (text.indexOf('指名') >= 0)     return 'first_nomination';
  return 'free';
}

// ===== セラピスト名検索（完全一致 → 前方一致）=====
function findTherapistByName(therapists, name) {
  var normalized = name.trim();
  for (var i = 0; i < therapists.length; i++) {
    if (therapists[i].name.trim() === normalized) return therapists[i];
  }
  var matched = [];
  for (var i = 0; i < therapists.length; i++) {
    if (therapists[i].name.trim().indexOf(normalized) === 0) matched.push(therapists[i]);
  }
  return matched.length === 1 ? matched[0] : null;
}

// ===== 日時フォーマット =====
function formatDate(date) {
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
}
function formatTime(date) {
  return Utilities.formatDate(date, 'Asia/Tokyo', 'HH:mm'); // ★ HH:mm:ss から HH:mm に変更してアプリと統一
}

// ===== Supabase REST APIラッパー =====
function supabaseRequest(key, method, path, body) {
  var options = {
    method: method,
    headers: {
      'apikey':        key,
      'Authorization': 'Bearer ' + key,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    muteHttpExceptions: true,
  };
  if (body) options.payload = JSON.stringify(body);
  var response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1' + path, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  if (code >= 400) throw new Error('HTTP ' + code + ': ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

function fetchTherapists(key) {
  return supabaseRequest(key, 'GET',
    '/therapists?shop_id=eq.' + SHOP_ID + '&select=id,name&order=name'
  ) || [];
}

function fetchDesignationTypeMap(key) {
  var types = supabaseRequest(key, 'GET',
    '/designation_types?shop_id=eq.' + SHOP_ID + '&is_active=eq.true&select=id,slug'
  ) || [];
  var map = {};
  types.forEach(function(t) { map[t.slug] = t.id; });
  return map;
}

function insertReservation(key, data) {
  supabaseRequest(key, 'POST', '/reservations', data);
}

function fetchActiveCoursesMap(key) {
  var rows = supabaseRequest(key, 'GET',
    '/courses?shop_id=eq.' + SHOP_ID + '&is_active=eq.true&select=id,duration,base_price'
  ) || [];
  var map = {};
  rows.forEach(function(c) {
    map[c.duration] = { id: c.id, base_price: c.base_price };
  });
  return map;
}

function calculateDuration(startStr, endStr) {
  var startParts = startStr.split(':');
  var endParts = endStr.split(':');
  var startMin = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
  var endMin = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
  if (endMin < startMin) {
    endMin += 24 * 60;
  }
  return endMin - startMin;
}
