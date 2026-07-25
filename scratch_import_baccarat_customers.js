const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  let p = rawPhone.replace(/\D/g, '');
  if (p.startsWith('81') && p.length > 10) {
    p = '0' + p.substring(2);
  }
  return p;
}

function cleanCustomerNameAndNote(rawName) {
  if (!rawName) return { name: '', note: '', skip: false };
  
  let s = rawName.trim();
  let notes = [];

  // 業者・ポータル用サポート番号の除外
  if (s.includes('ガイドライン') || s.includes('無料サイト') || s.includes('エステ魂') || s.includes('サポート') || s.includes('通信業者') || s.includes('エキテン')) {
    return { name: '', note: '', skip: true };
  }

  // 補足メモの抽出
  const noteKeywords = ['怪しい', '新人', 'プロ', 'ss', 'SS', 'NG', 'ng', '90分', '60分', '120分', 'キャンセル', '着拒', '仮予約', '抜こうとする'];
  for (const kw of noteKeywords) {
    if (s.includes(kw)) {
      notes.push(kw);
    }
  }

  // 名前末尾の 4桁数字やタグの除去
  let cleanName = s
    .replace(/\d{4}/g, '')
    .replace(/ss|SS|NG|ng|90分|60分|120分/g, '')
    .replace(/[\s\u3000]+/g, ' ')
    .trim();

  if (!cleanName && s) {
    cleanName = s;
  }

  return {
    name: cleanName,
    note: notes.join(', '),
    skip: false
  };
}

function parseVcfFile(filepath, shopName) {
  if (!fs.existsSync(filepath)) return [];
  const content = fs.readFileSync(filepath, 'utf8');
  const cards = content.split('END:VCARD');
  
  const results = [];
  for (const card of cards) {
    if (!card.includes('BEGIN:VCARD')) continue;

    let fn = '';
    let tel = '';
    let note = '';

    const lines = card.split(/\r?\n/);
    for (let line of lines) {
      if (line.startsWith('FN:')) {
        fn = line.substring(3).trim();
      } else if (!fn && line.startsWith('N:')) {
        fn = line.substring(2).replace(/;/g, ' ').trim();
      } else if (line.startsWith('TEL')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          tel = parts[1].trim();
        }
      } else if (line.startsWith('NOTE:')) {
        note = line.substring(5).trim();
      }
    }

    const normPhone = normalizePhone(tel);
    if (!normPhone || normPhone.length < 10) continue;

    const cleaned = cleanCustomerNameAndNote(fn);
    if (cleaned.skip) continue;

    const fullNote = [note, cleaned.note].filter(Boolean).join(' / ');

    results.push({
      name: cleaned.name || fn,
      phone: normPhone,
      note: fullNote,
      shopName: shopName
    });
  }
  return results;
}

async function importBaccaratCustomers() {
  console.log("=== バカラ顧客情報の一括クリーニング・インポート開始 ===");

  // 1. バカラグループオーナーおよび主要店舗IDの取得
  const { data: owner } = await supabase.from('owners').select('id, name').ilike('name', '%バカラ%').single();
  if (!owner) {
    console.error("バカラグループが見つかりません");
    return;
  }
  const { data: mainShop } = await supabase.from('shops').select('id, name').eq('owner_id', owner.id).limit(1).single();

  console.log(`オーナーグループ: ${owner.name} (${owner.id}) / デフォルト店舗: ${mainShop.name}`);

  // 2. VCFファイルのパース
  const entries1 = parseVcfFile('shuunan.vcf', 'バカラ周南下松');
  const entries2 = parseVcfFile('yamaguti.vcf', 'バカラ山口湯田');
  const entries3 = parseVcfFile('ube.vcf', 'バカラ宇部');

  const allEntries = [...entries1, ...entries2, ...entries3];

  // 3. 名寄せ・重複排除
  const phoneMap = new Map();
  for (const item of allEntries) {
    const existing = phoneMap.get(item.phone);
    if (!existing) {
      phoneMap.set(item.phone, {
        name: item.name,
        phone: item.phone,
        notes: item.note ? [item.note] : [],
        shops: [item.shopName]
      });
    } else {
      if (item.name && item.name.length > existing.name.length && !existing.name.includes('さん')) {
        existing.name = item.name;
      }
      if (item.note && !existing.notes.includes(item.note)) {
        existing.notes.push(item.note);
      }
      if (!existing.shops.includes(item.shopName)) {
        existing.shops.push(item.shopName);
      }
    }
  }

  const uniqueCustomers = Array.from(phoneMap.values());
  console.log(`インポート対象ユニーク顧客数: ${uniqueCustomers.length} 名`);

  // 4. DB へのバッチ投入 (100件ずつ)
  let successCount = 0;
  let updateCount = 0;
  const batchSize = 100;

  for (let i = 0; i < uniqueCustomers.length; i += batchSize) {
    const batch = uniqueCustomers.slice(i, i + batchSize);
    
    // DB 内の既存顧客電話番号を取得
    const phones = batch.map(c => c.phone);
    const { data: existingDbCustomers } = await supabase
      .from('customers')
      .select('id, phone, memo')
      .in('phone', phones);

    const existingPhoneSet = new Map((existingDbCustomers || []).map(c => [c.phone, c]));

    const toInsert = [];
    for (const c of batch) {
      const dbCust = existingPhoneSet.get(c.phone);
      const noteStr = [...c.notes, `検出店舗: ${c.shops.join(', ')}`].filter(Boolean).join(' | ');

      if (dbCust) {
        // 既存顧客の更新
        const newMemo = dbCust.memo ? `${dbCust.memo} | ${noteStr}` : noteStr;
        await supabase
          .from('customers')
          .update({
            memo: newMemo
          })
          .eq('id', dbCust.id);
        updateCount++;
      } else {
        // 新規挿入
        toInsert.push({
          shop_id: mainShop.id,
          name: c.name || 'お客様',
          phone: c.phone,
          memo: noteStr,
          status: '予約可',
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insErr } = await supabase
        .from('customers')
        .insert(toInsert)
        .select('id');

      if (insErr) {
        console.error(`バッチ ${i / batchSize + 1} 登録エラー:`, insErr.message);
      } else {
        successCount += inserted?.length || 0;
      }
    }

    console.log(`進捗: ${Math.min(i + batchSize, uniqueCustomers.length)} / ${uniqueCustomers.length} 完了...`);
  }

  console.log(`\n=== インポート＆クリーニング完了 ===`);
  console.log(`新規登録: ${successCount} 名`);
  console.log(`既存更新・紐付け: ${updateCount} 名`);
  console.log(`合計対象: ${successCount + updateCount} 名`);
}

importBaccaratCustomers();
