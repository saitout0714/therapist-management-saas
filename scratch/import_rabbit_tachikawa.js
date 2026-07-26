const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  let p = rawPhone.replace(/\D/g, '');
  // 国際形式 +81 → 0 に変換
  if (p.startsWith('81') && p.length > 10) {
    p = '0' + p.substring(2);
  }
  return p;
}

// VCF をパースして { name, phone } の配列を返す
// 名前は FN そのまま使用（すでに「名前＋下4桁」形式）
// ただし電話番号が無い・10桁未満・明らかな業者名はスキップ
function parseVcf(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const cards = content.split(/END:VCARD/i);
  const results = [];

  for (const card of cards) {
    if (!card.includes('BEGIN:VCARD')) continue;

    let fn = '';
    const phones = [];

    const lines = card.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('FN:')) {
        fn = line.substring(3).trim();
      } else if (!fn && line.startsWith('N:')) {
        fn = line.substring(2).replace(/;/g, ' ').trim();
      } else if (line.startsWith('TEL')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          const p = normalizePhone(parts[1].trim());
          if (p && p.length >= 10) phones.push(p);
        }
      }
    }

    if (phones.length === 0) continue;

    // 明らかな業者・スタッフ名はスキップ
    const skip = ['ガイドライン', '無料サイト', 'エステ魂', 'サポート', '通信業者', 'エキテン',
                  '電気営業', '受付担当', '担当', '営業', '工事', '配達', '宅配'].some(w => fn.includes(w));
    if (skip) continue;

    // FN の名前をそのまま顧客名として使用
    // 名前が空の場合は電話番号下4桁で補完
    const phone = phones[0];
    const last4 = phone.slice(-4);
    const name = fn || `お客様${last4}`;

    results.push({ name, phone });
  }

  return results;
}

async function main() {
  console.log('=== ラビット立川 顧客インポート開始 ===');

  // ラビット立川の shop_id を取得
  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .select('id, name')
    .eq('name', 'ラビット立川')
    .single();

  if (shopErr || !shop) {
    console.error('ラビット立川が見つかりません:', shopErr?.message);
    return;
  }
  console.log(`対象店舗: ${shop.name} (${shop.id})`);

  // VCF パース
  const vcfPath = 'rabitttachikawa.vcf';
  if (!fs.existsSync(vcfPath)) {
    console.error(`VCFファイルが見つかりません: ${vcfPath}`);
    return;
  }

  const entries = parseVcf(vcfPath);
  console.log(`VCFから ${entries.length} 件を読み込みました`);

  // 電話番号で重複排除（同じ電話番号が複数カードにある場合）
  const phoneMap = new Map();
  for (const e of entries) {
    if (!phoneMap.has(e.phone)) {
      phoneMap.set(e.phone, e);
    }
  }
  const unique = Array.from(phoneMap.values());
  console.log(`重複除去後: ${unique.length} 件`);

  // 既にDBに同じ電話番号で登録済みの顧客を確認（店舗問わず）
  const allPhones = unique.map(e => e.phone);
  const { data: existing } = await supabase
    .from('customers')
    .select('id, phone, name, shop_id')
    .in('phone', allPhones);

  const existingPhoneSet = new Set((existing || []).map(c => c.phone));
  const existingShopPhone = new Set(
    (existing || []).filter(c => c.shop_id === shop.id).map(c => c.phone)
  );

  const toInsert = [];
  let skipSameShop = 0;
  let skipOtherShop = 0;

  for (const e of unique) {
    if (existingShopPhone.has(e.phone)) {
      skipSameShop++;
      continue; // 同店舗に既存 → スキップ
    }
    if (existingPhoneSet.has(e.phone)) {
      // 他店舗に存在 → それでも新規登録（ラビット立川の顧客として）
      skipOtherShop++;
    }
    toInsert.push({
      shop_id: shop.id,
      name: e.name,
      phone: e.phone,
      status: '予約可',
    });
  }

  console.log(`新規登録対象: ${toInsert.length} 件`);
  console.log(`同店舗に既存のためスキップ: ${skipSameShop} 件`);
  console.log(`他店舗に存在（新規登録対象に含む）: ${skipOtherShop} 件`);

  if (toInsert.length === 0) {
    console.log('登録対象がありません。終了します。');
    return;
  }

  // 100件ずつバッチ挿入
  const BATCH = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { data: inserted, error: insErr } = await supabase
      .from('customers')
      .insert(batch)
      .select('id');

    if (insErr) {
      console.error(`バッチ ${Math.floor(i / BATCH) + 1} エラー:`, insErr.message);
      errorCount += batch.length;
    } else {
      successCount += inserted?.length || 0;
    }

    const done = Math.min(i + BATCH, toInsert.length);
    process.stdout.write(`\r進捗: ${done} / ${toInsert.length} 件完了...`);
  }

  console.log(`\n\n=== インポート完了 ===`);
  console.log(`新規登録成功: ${successCount} 件`);
  if (errorCount > 0) console.log(`エラー: ${errorCount} 件`);
}

main().catch(console.error);
