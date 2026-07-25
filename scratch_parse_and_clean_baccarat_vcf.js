const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// 電話番号の正規化 (ハイフン・スペース・国番号の除去)
function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  let p = rawPhone.replace(/\D/g, '');
  if (p.startsWith('81') && p.length > 10) {
    p = '0' + p.substring(2);
  }
  return p;
}

// 名前のクリーンアップ & メモ抽出
function cleanCustomerNameAndNote(rawName) {
  if (!rawName) return { name: '', note: '' };
  
  let s = rawName.trim();
  let notes = [];

  // 無効・無視するキーワード
  if (s.includes('ガイドライン') || s.includes('無料サイト') || s.includes('エステ魂') || s.includes('サポート')) {
    return { name: '', note: '', skip: true };
  }

  // 補足メモの抽出（例: ss, 90分, 仮予約怪しい, 新人につけるな等）
  const noteKeywords = ['怪しい', '新人', 'プロ', 'ss', 'SS', 'NG', 'ng', '90分', '60分', '120分', 'キャンセル', '着拒', '仮予約'];
  for (const kw of noteKeywords) {
    if (s.includes(kw)) {
      notes.push(kw);
    }
  }

  // 名前末尾または途中の 4桁数字 (例: 藤本さん6601 -> 藤本さん)
  let cleanName = s
    .replace(/\d{4}/g, '')
    .replace(/ss|SS|NG|ng|90分|60分|120分/g, '')
    .replace(/[\s\u3000]+/g, ' ')
    .trim();

  if (!cleanName && s) {
    cleanName = s; // 全体数字等の場合
  }

  return {
    name: cleanName,
    note: notes.join(', '),
    skip: false
  };
}

// VCF ファイルパース処理
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
    if (!normPhone || normPhone.length < 10) continue; // 電話番号がない/短すぎるものは除外

    const cleaned = cleanCustomerNameAndNote(fn);
    if (cleaned.skip) continue;

    const fullNote = [note, cleaned.note].filter(Boolean).join(' / ');

    results.push({
      rawName: fn,
      name: cleaned.name || fn,
      phone: normPhone,
      note: fullNote,
      shopName: shopName
    });
  }
  return results;
}

async function analyzeBaccaratVcfs() {
  console.log("=== VCFファイルの解析＆重複チェック開始 ===");

  const file1 = parseVcfFile('shuunan.vcf', 'バカラ周南下松');
  const file2 = parseVcfFile('yamaguti.vcf', 'バカラ山口湯田');
  const file3 = parseVcfFile('ube.vcf', 'バカラ宇部');

  const allEntries = [...file1, ...file2, ...file3];
  console.log(`抽出件数: 周南下松 (${file1.length}件), 山口湯田 (${file2.length}件), 宇部 (${file3.length}件) / 総計: ${allEntries.length}件`);

  // 電話番号ベースでの名寄せ（重複排除）
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
      // 既存データに結合
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
  console.log(`\n【名寄せ・重複排除後】 有効ユニーク顧客数: ${uniqueCustomers.length} 名`);
  console.log(`重複排除された件数: ${allEntries.length - uniqueCustomers.length} 件`);

  console.log("\n--- クリーニング後のサンプルデータ (先頭10件) ---");
  uniqueCustomers.slice(0, 10).forEach((c, i) => {
    console.log(`${i + 1}. 名前: "${c.name}" / 電話: "${c.phone}" / 検出店舗: [${c.shops.join(', ')}] / メモ: "${c.notes.join(' / ')}"`);
  });
}

analyzeBaccaratVcfs();
