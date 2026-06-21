/**
 * yoyakl Googleカレンダー リアルタイム同期中継スクリプト (汎用マルチテナント対応版)
 *
 * デプロイ方法:
 * 1. Google Apps Script エディタを開きます。
 * 2. このコードを貼り付けます。
 * 3. スクリプトのプロパティに「SYNC_API_TOKEN」を設定します (例: yoyakl_sync_token_2026).
 * 4. デプロイ > 新しいデプロイ を選択。
 * 5. 種類の選択で「ウェブアプリ」を選択。
 * 6. 次の設定でデプロイします。
 *    - 次のユーザーとして実行: 自分 (カレンダーを所有/共有しているアカウント)
 *    - アクセスできるユーザー: 全員 (匿名含む)
 * 7. 発行された「ウェブアプリのURL」を Next.js の環境変数 (GAS_CALENDAR_SYNC_URL) に設定します。
 */

// セキュリティトークンの確認
function checkAuth(e) {
  var expectedToken = PropertiesService.getScriptProperties().getProperty('SYNC_API_TOKEN') || 'yoyakl_sync_token_2026';
  
  // クエリパラメータまたはヘッダーからトークンを取得
  var token = e.parameter.token;
  if (!token && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      token = body.token;
    } catch(err) {}
  }
  
  if (token !== expectedToken) {
    throw new Error('Unauthorized: Invalid API Token.');
  }
}

function doPost(e) {
  var result = { ok: false };
  try {
    // 認証チェック
    checkAuth(e);

    var params = JSON.parse(e.postData.contents);
    var action = params.action; // 'create' | 'update' | 'cancel' | 'delete'
    var calendarId = params.calendarId;
    var eventId = params.eventId;
    var title = params.title;
    var dateStr = params.date; // yyyy-MM-dd
    var startTimeStr = params.startTime; // HH:mm
    var endTimeStr = params.endTime; // HH:mm

    // カレンダーの取得
    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      throw new Error('Calendar not found: ' + calendarId);
    }

    // 時刻オブジェクトの作成 (日本時間 JST 基準 / 深夜時間・日またぎ対応)
    var startDateTime = parseDateTime(dateStr, startTimeStr);
    var endDateTime = parseDateTime(dateStr, endTimeStr);

    // 終了時間が開始時間より前の場合は、日またぎ（翌日未明）として終了日を1日進める
    if (startDateTime && endDateTime && endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    if (action === 'create') {
      if (!startDateTime || !endDateTime) throw new Error('Missing datetime params for create');
      
      var event = calendar.createEvent(title, startDateTime, endDateTime, {
        description: 'yoyakl 自動同期システムより作成'
      });
      
      result.ok = true;
      result.eventId = event.getId();
      result.message = 'Event created successfully';

    } else if (action === 'update') {
      if (!eventId) throw new Error('Missing eventId for update');
      var event = calendar.getEventById(eventId);
      if (!event) {
        throw new Error('Event not found: ' + eventId);
      }

      event.setTitle(title);
      if (startDateTime && endDateTime) {
        event.setTime(startDateTime, endDateTime);
      }
      
      result.ok = true;
      result.message = 'Event updated successfully';

    } else if (action === 'cancel') {
      if (!eventId) throw new Error('Missing eventId for cancel');
      var event = calendar.getEventById(eventId);
      if (!event) {
        throw new Error('Event not found: ' + eventId);
      }

      // タイトルに「【キャンセル】」が付いていない場合のみ追加
      var currentTitle = event.getTitle();
      var cleanTitle = currentTitle.replace(/^【キャンセル】\s*/, '');
      event.setTitle('【キャンセル】 ' + cleanTitle);
      
      // イベントの色を「赤」に変更
      // 11 は Bold Red (トマト色に近いカレンダー標準の赤色)
      event.setColor('11');

      result.ok = true;
      result.message = 'Event status set to cancelled (color set to red)';

    } else if (action === 'delete') {
      if (!eventId) throw new Error('Missing eventId for delete');
      var event = calendar.getEventById(eventId);
      if (event) {
        event.deleteEvent();
        result.ok = true;
        result.message = 'Event deleted successfully';
      } else {
        // すでにカレンダー上で削除されている場合はエラーにせず成功扱いにする
        result.ok = true;
        result.message = 'Event already deleted or not found';
      }
    } else {
      throw new Error('Unknown action: ' + action);
    }

  } catch (err) {
    result.ok = false;
    result.error = String(err);
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 営業日日付 (YYYY-MM-DD) と時間 (HH:mm) から、
 * 実時間基準の Date オブジェクトを作成します。(深夜 24時以降や 00:00〜04:59 の翌日ズレに対応)
 */
function parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  
  var timeMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;
  
  var h = parseInt(timeMatch[1], 10);
  var m = parseInt(timeMatch[2], 10);
  
  var dateParts = dateStr.split('-');
  var y = parseInt(dateParts[0], 10);
  var M = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
  var d = parseInt(dateParts[2], 10);
  
  // 基準日を0時0分0秒で初期化
  var dt = new Date(y, M, d, 0, 0, 0);
  
  // 深夜時間の判定
  // 1) 24時間以上の表記（例: 25:30）の場合は翌日にして時間を24引く
  if (h >= 24) {
    dt.setDate(dt.getDate() + 1);
    h = h - 24;
  }
  // 2) 00:00 〜 04:59 の表記の場合、営業システムの日付（営業日）を基準としているため
  // 実際には翌日の早朝にあたる。日付を1日進める。
  else if (h < 5) {
    dt.setDate(dt.getDate() + 1);
  }
  
  dt.setHours(h);
  dt.setMinutes(m);
  return dt;
}
