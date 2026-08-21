/**
 * エステラブの出勤情報ページを「読み取るだけ」で確認するスクリプト（書き込みなし）。
 * 指定日に何が表示されているかをコンソールに出す。
 *
 *   npx tsx scripts/check-eslove-date.ts 2026-08-19
 *
 * エステラブは本番サーバー(Vercel/AWSのIP)からのアクセスを403で拒否するため、
 * 店舗PCなど通常回線から実行する必要がある。
 */
import * as dotenv from 'dotenv';
import { chromium } from 'playwright';

dotenv.config({ path: '.env.local' });

const SCHEDULE_BASE_URL = 'https://eslove.jp/admin/shop/therapist_schedule/daily';

function toCompactDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function guessDayOffset(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const jstMs = now.getTime() + (now.getTimezoneOffset() + 540) * 60000;
  const jstNow = new Date(jstMs);
  const todayUTC = Date.UTC(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
  return Math.round((target - todayUTC) / 86400000);
}

function diffDays(fromCompact: string, toCompact: string): number {
  const parse = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  return Math.round((parse(toCompact) - parse(fromCompact)) / 86400000);
}

async function main() {
  const dateStr = process.argv[2];
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    console.error('使い方: npx tsx scripts/check-eslove-date.ts YYYY-MM-DD');
    process.exit(1);
  }

  const { supabaseAdmin: supabase } = await import('../lib/supabaseAdmin');
  const { getEsloveCredentials, PORTAL_CREDENTIAL_COLUMNS } = await import('../lib/sync/portal-credentials');

  const SHOP_ID = 'dc3caa06-fcc2-4bdc-b063-7969296efd34';
  const { data: shop, error } = await supabase
    .from('shops')
    .select(`id, name, ${PORTAL_CREDENTIAL_COLUMNS}`)
    .eq('id', SHOP_ID)
    .single();
  if (error || !shop) throw error || new Error('shop not found');

  const creds = getEsloveCredentials(shop as any);
  if (!creds) throw new Error('エステラブの認証情報が未設定です');

  const browser = await chromium.launch({ headless: true, args: process.platform === 'win32' ? [] : undefined });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('ログイン中...');
    page.on('dialog', (d) => d.accept().catch(() => {}));
    const resp = await page.goto(creds.loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    const idInput = await page.waitForSelector('input[type="text"], input[name="login_id"]', { timeout: 8000 }).catch(() => null);
    const passInput = await page.waitForSelector('input[type="password"]', { timeout: 8000 }).catch(() => null);
    if (!idInput || !passInput) {
      const status = typeof resp?.status === 'function' ? resp.status() : '不明';
      const title = await page.title().catch(() => 'unknown');
      throw new Error(`ログインページを開けませんでした。HTTP ${status} / タイトル: ${title} / URL: ${page.url()}`);
    }
    await idInput.fill(creds.loginId);
    await passInput.fill(creds.password);
    const submitButton = await page.$('button[type="submit"], input[type="submit"]');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      submitButton ? submitButton.click() : page.keyboard.press('Enter'),
    ]);
    if (page.url().includes('/login')) {
      throw new Error(`ログイン失敗。タイトル: ${await page.title().catch(() => 'unknown')} / URL: ${page.url()}`);
    }
    console.log('ログイン成功。対象日のページを開きます...');

    const wanted = toCompactDate(dateStr);
    let offset = guessDayOffset(dateStr);
    let shown: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.goto(`${SCHEDULE_BASE_URL}?day=${offset}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
      await page.waitForSelector('input[name^="TherapistSchedules"][name$="[day]"]', { state: 'attached', timeout: 20000 }).catch(() => {});
      shown = await page.evaluate(() => {
        const el = document.querySelector('input[name^="TherapistSchedules"][name$="[day]"]') as HTMLInputElement | null;
        return el?.value || null;
      });
      if (!shown) break;
      if (shown === wanted) break;
      const correction = diffDays(shown, wanted);
      if (correction === 0) break;
      console.log(`day=${offset} は ${shown} だったため ${correction} 日ぶん補正します`);
      offset += correction;
    }

    console.log(`表示中の日付（隠しフィールド）: ${shown}`);
    console.log(`URL: ${page.url()}`);

    const rows = await page.evaluate(() => {
      const out: any[] = [];
      document.querySelectorAll('input[name^="TherapistSchedules"][name$="[therapist_id]"]').forEach((el: any) => {
        const m = (el.getAttribute('name') || '').match(/TherapistSchedules\[(\d+)\]/);
        if (!m) return;
        const i = m[1];
        const nameEl = document.querySelector(`tr:has(input[name="TherapistSchedules[${i}][therapist_id]"]) td:first-child`);
        const startEl = document.querySelector(`select[name="TherapistSchedules[${i}][start_time]"]`) as HTMLSelectElement | null;
        const endEl = document.querySelector(`select[name="TherapistSchedules[${i}][end_time]"]`) as HTMLSelectElement | null;
        out.push({
          therapistId: el.value,
          rowText: nameEl?.textContent?.trim() || '',
          start: startEl?.selectedOptions?.[0]?.textContent?.trim() || startEl?.value || '',
          end: endEl?.selectedOptions?.[0]?.textContent?.trim() || endEl?.value || '',
        });
      });
      return out;
    });

    console.log(`行数: ${rows.length}`);
    for (const r of rows) {
      if (r.start || r.end) {
        console.log(`  [${r.therapistId}] ${r.rowText} : ${r.start} 〜 ${r.end}`);
      }
    }
    console.log('（時刻が空欄の行は「休み/未設定」として省略しています）');
  } finally {
    await browser.close();
  }
}

main().catch(e => {
  console.error('エラー:', e.message || e);
  process.exit(1);
});
