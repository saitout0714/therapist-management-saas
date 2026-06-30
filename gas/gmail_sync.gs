/**
 * yoyakl Gmail同期スクリプト (Google Apps Script用)
 * 
 * このスクリプトは、各オーナーのGoogleアカウント（Gmail）で定期実行（トリガー）を設定して動作させます。
 * 未読の予約メールを検知して、yoyakl SaaSのAPIへ送信し、自動で予約の登録とリアルタイム通知を行います。
 */

// ==================== 設定エリア ====================
// yoyaklがデプロイされているURL（末尾にスラッシュは不要）
const YOYAKL_BASE_URL = "https://your-yoyakl-domain.com";

// API認証キー (yoyaklの環境変数 MAIL_SYNC_API_KEY と一致させてください)
const MAIL_SYNC_API_KEY = "your-mail-sync-api-key";

// このGmailが紐づく店舗のID (yoyaklの店舗ID)
const DEFAULT_SHOP_ID = "your-shop-id";

// Gmailの検索条件 (未読かつ特定の媒体からの予約通知タイトルに合致するもののみ)
const GMAIL_SEARCH_QUERY = 'is:unread (subject:"【エステ魂】ご予約を受け付けました" OR subject:"[Grow] 新しいWeb予約を受け付けました" OR subject:"【全国メンズエステランキング】仮予約を受け付けました" OR subject:"エステラブ")';
// ====================================================

function syncGmailReservations() {
  const threads = GmailApp.search(GMAIL_SEARCH_QUERY, 0, 20); // 一度に最大20スレッド処理
  if (threads.length === 0) {
    Logger.log("新着の予約メールはありません。");
    return;
  }

  Logger.log(`${threads.length}件の予約候補メールスレッドを検出しました。`);

  const apiUrl = `${YOYAKL_BASE_URL.replace(/\/$/, "")}/api/reserve/mail-sync`;
  const headers = {
    "Content-Type": "application/json",
    "X-Yoyakl-API-Key": MAIL_SYNC_API_KEY
  };

  threads.forEach(thread => {
    const messages = thread.getMessages();
    
    messages.forEach(message => {
      // 未読メッセージのみ処理
      if (!message.isUnread()) {
        return;
      }

      const subject = message.getSubject();
      const body = message.getPlainBody();
      const date = message.getDate();

      Logger.log(`処理中: ${subject} (${date})`);

      const payload = {
        subject: subject,
        body: body,
        shop_id: DEFAULT_SHOP_ID
      };

      const options = {
        method: "post",
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true // エラー時も例外を投げずにレスポンスコードを取得
      };

      try {
        const response = UrlFetchApp.fetch(apiUrl, options);
        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (responseCode === 200 || responseCode === 201) {
          Logger.log(`同期成功: ${subject}`);
          message.markRead(); // 成功したら既読にして次回処理から除外
        } else {
          Logger.log(`同期失敗: ${subject} (ステータスコード: ${responseCode})`);
          Logger.log(`エラー内容: ${responseText}`);
        }
      } catch (e) {
        Logger.log(`通信エラーが発生しました: ${e.toString()}`);
      }
    });
  });
}

/**
 * 初回セットアップ用の関数
 * トリガーを1分おきに実行するように設定します。
 */
function setupTrigger() {
  // 既存の同一トリガーがあれば削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "syncGmailReservations") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 1分ごとに定期実行するトリガーを新規作成
  ScriptApp.newTrigger("syncGmailReservations")
    .timeBased()
    .everyMinutes(1)
    .create();
  
  Logger.log("1分おきの定期実行トリガーを正常に設定しました。");
}
