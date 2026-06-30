const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.MAIL_SYNC_API_KEY || 'test-key';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase URL or Service Role Key is missing in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const estheDamashiiMail = {
  subject: "【エステ魂】ご予約を受け付けました ※このメールには返信できません",
  body: `━━━━━━━━━━━━━━
【エステ魂】ご予約を受け付けました
━━━━━━━━━━━━━━
[お店番号：44652]　裏妻SPA様
supaliqi@gmail.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

いつも【エステ魂】をご利用頂きまして誠にありがとうございます。

ご予約希望の内容をご確認頂きまして、お客様へのご連絡をお願い致します。
※このメールには返信できません。

━━━━━━━━━━━━━━
★お客様のご連絡先
━━━━━━━━━━━━━━
■お名前：吉村　将樹

■メールアドレス：kbt.slo.510@gmail.com

■電話番号：09054713492

■来店歴：新規

■ご要望：
電話に出られない可能性があるため、ご連絡はメールでいただきたいです。

━━━━━━━━━━━━━━
★ご予約内容
━━━━━━━━━━━━━━

■ご希望日時：6/29 (月) 20:00

■ご希望セラピスト：みなみ

■ご希望コース：
コース(90分)

■ご希望のクーポン：
===============================
✨新規限定キャンペーン✨
===============================
合計金額：17,000円
━━━━━━━━━━━━━━`
};

const growMail = {
  subject: "[Grow] 新しいWeb予約を受け付けました",
  body: `以下の内容で、新しいWeb予約を受け付けました。

店舗：Legendひばりヶ丘 PREMIUM EDITION
予約日時：2026年06月28日(日)22:30
担当セラピスト：黒名ゆい (20)【期間限定】新人割1,000円引き＋初回指名料無料

指名：本指名
メニュー：120min　23,000yen
クーポン：
料金：0円
お客様名：吉田 英明
電話番号：09052110407
メールアドレス：frx03654@gmail.com
備考：

---------
Grow`
};

const tigerLillyMail = {
  subject: "[Grow] 新しい店舗予約を受け付けました",
  body: `以下の内容で、新しい店舗予約を受け付けました。

店舗：Tiger Lilly 武蔵浦和
予約日時：2026年06月30日(火)16:20
担当セラピスト：藤崎かな(26)【期間限定】初回指名料無料
指名：本指名
メニュー：120min　23,000yen
クーポン：
料金：0円
お客様名：ヨシダ　トモエ
電話番号：08095422829
メールアドレス：
備考：

---------
Grow`
};


const rankingMail = {
  subject: "【全国メンズエステランキング】仮予約を受け付けました",
  body: `以下の内容にて仮予約を受付ました。

--------------------------------------
お申込み内容
--------------------------------------
【お名前】
わたなべ 様

【メールアドレス】
prdaiki1216@gmail.com

【電話番号】
09091805648

--------------------------------------
ご予約内容
--------------------------------------
【店名】
Crystal SPA

【ご希望セラピスト】
みれい

【ご予約日時】
2026年6月25日（木） 19:00

【ご希望コース】
本指名:2,000円
メインコース 90分：16,000円

--------------------------------------
料金のお見積り
--------------------------------------
合計：18000円`
};

async function runTest() {
  // 店舗を1つ取得
  const { data: shops, error: shopErr } = await supabase.from('shops').select('id, name').limit(1);
  if (shopErr || !shops || shops.length === 0) {
    console.error("Failed to fetch default shop:", shopErr);
    process.exit(1);
  }
  const defaultShopId = shops[0].id;
  console.log(`Using default shop ID: ${defaultShopId} (${shops[0].name})`);

  const createdReservationIds = [];

  try {
    // 1. 初回の「エステ魂」メール送信
    console.log(`\n--- [Test 1] Sending Esthe Damashii (First Time) ---`);
    const res1 = await fetch('http://localhost:3000/api/reserve/mail-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Yoyakl-API-Key': apiKey },
      body: JSON.stringify({
        subject: estheDamashiiMail.subject,
        body: estheDamashiiMail.body,
        shop_id: defaultShopId
      })
    });
    
    const json1 = await res1.json();
    console.log(`Status: ${res1.status}`);
    if (json1.success && json1.reservation) {
      const resId = json1.reservation.id;
      createdReservationIds.push(resId);
      console.log(`Created reservation ID: ${resId}`);

      // 重複検知させるために、1回目の予約を強制的に「確定 (confirmed)」に変更
      console.log("Forcing reservation status to 'confirmed' for double-booking test...");
      const { error: updateErr } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', resId);
      
      if (updateErr) {
        console.error("Failed to update status to confirmed:", updateErr);
      } else {
        console.log("Status updated successfully.");
      }
    } else {
      console.error("Test 1 failed:", json1);
    }

    // 2. 重複した「エステ魂」メール送信（同一セラピスト・同一日時）
    console.log(`\n--- [Test 2] Sending Duplicate Esthe Damashii (Should Trigger Warning) ---`);
    const res2 = await fetch('http://localhost:3000/api/reserve/mail-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Yoyakl-API-Key': apiKey },
      body: JSON.stringify({
        subject: estheDamashiiMail.subject,
        body: estheDamashiiMail.body,
        shop_id: defaultShopId
      })
    });

    const json2 = await res2.json();
    console.log(`Status: ${res2.status}`);
    if (json2.success && json2.reservation) {
      createdReservationIds.push(json2.reservation.id);
      console.log("Notes Response contains warning?");
      console.log(json2.reservation.notes.startsWith("【⚠️警告") ? "✅ YES (Warning trigger success)" : "❌ NO");
      console.log("Warning Text:\n", json2.reservation.notes.split("\n\n")[0]);
    } else {
      console.error("Test 2 failed:", json2);
    }

    // 3. growメールの送信 (こちらは即時 confirmed, is_handled=true になるはず)
    console.log(`\n--- [Test 3] Sending Grow Mail (Should be immediately confirmed) ---`);
    const res3 = await fetch('http://localhost:3000/api/reserve/mail-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Yoyakl-API-Key': apiKey },
      body: JSON.stringify({
        subject: growMail.subject,
        body: growMail.body,
        shop_id: defaultShopId
      })
    });
    const json3 = await res3.json();
    console.log(`Status: ${res3.status}`);
    if (json3.success && json3.reservation) {
      createdReservationIds.push(json3.reservation.id);
      console.log(`Status Result: ${json3.reservation.status} (Expected: confirmed)`);
      console.log(`Is Handled: ${json3.reservation.is_handled} (Expected: true)`);
    }

    // 4. 全国メンズエステランキングメールの送信 (仮予約なので pending, is_handled=false)
    console.log(`\n--- [Test 4] Sending Ranking Mail (Should be pending) ---`);
    const res4 = await fetch('http://localhost:3000/api/reserve/mail-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Yoyakl-API-Key': apiKey },
      body: JSON.stringify({
        subject: rankingMail.subject,
        body: rankingMail.body,
        shop_id: defaultShopId
      })
    });
    const json4 = await res4.json();
    console.log(`Status: ${res4.status}`);
    if (json4.success && json4.reservation) {
      createdReservationIds.push(json4.reservation.id);
      console.log(`Status Result: ${json4.reservation.status} (Expected: pending)`);
      console.log(`Is Handled: ${json4.reservation.is_handled} (Expected: false)`);
    }
    // 5. Tiger Lilly（Grow 店舗予約）メールの送信 (即時 confirmed, is_handled=true になるはず)
    console.log(`\n--- [Test 5] Sending Tiger Lilly Mail (Should be confirmed) ---`);
    const res5 = await fetch('http://localhost:3000/api/reserve/mail-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Yoyakl-API-Key': apiKey },
      body: JSON.stringify({
        subject: tigerLillyMail.subject,
        body: tigerLillyMail.body,
        shop_id: defaultShopId
      })
    });
    const json5 = await res5.json();
    console.log(`Status: ${res5.status}`);
    if (json5.success && json5.reservation) {
      createdReservationIds.push(json5.reservation.id);
      console.log(`Status Result: ${json5.reservation.status} (Expected: confirmed)`);
      console.log(`Is Handled: ${json5.reservation.is_handled} (Expected: true)`);
      console.log(`Shop ID: ${json5.reservation.shop_id} (Expected: Tiger Lilly '4808aee9-9940-410c-aa5b-dd1364e2da2c')`);
      console.log(`Therapist ID: ${json5.reservation.therapist_id} (Expected: '4001bc45-499e-4c89-8482-734cf123f571')`);
    } else {
      console.error("Test 5 failed:", json5);
    }

  } catch (e) {
    console.error('Error during testing:', e);
  } finally {
    // 5. テストデータのクリーンアップ（作成した予約と顧客を削除）
    if (createdReservationIds.length > 0) {
      console.log(`\n--- Cleaning up ${createdReservationIds.length} test reservation(s) ---`);
      
      // 作成された予約に紐づく顧客IDを取得
      const { data: resData } = await supabase
        .from('reservations')
        .select('customer_id')
        .in('id', createdReservationIds);
      
      const customerIds = resData ? resData.map(r => r.customer_id).filter(id => id !== null) : [];

      // 予約を削除
      const { error: delResErr } = await supabase
        .from('reservations')
        .delete()
        .in('id', createdReservationIds);
      
      if (delResErr) {
        console.error("Failed to delete test reservations:", delResErr);
      } else {
        console.log("Test reservations deleted.");
      }

      // 自動作成された顧客を削除
      if (customerIds.length > 0) {
        const { error: delCustErr } = await supabase
          .from('customers')
          .delete()
          .in('id', customerIds);
        
        if (delCustErr) {
          console.error("Failed to delete test customers:", delCustErr);
        } else {
          console.log("Test customers deleted.");
        }
      }
    }
  }
}

runTest();
