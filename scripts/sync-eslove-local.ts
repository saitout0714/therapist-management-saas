/**
 * エステラブ同期のローカル実行スクリプト
 *
 * 【なぜこのスクリプトがあるか】
 * エステラブ(eslove.jp)は本番サーバー(Vercel)のIPからのアクセスを403 Forbiddenで
 * ブロックしているため、本番のcron・手動同期からは同期できない。
 * 一方、店舗のPC（通常の回線）からはブロックされずアクセスできるため、
 * このスクリプトをローカルで実行することで同期を行う。
 * 同期ロジック本体は本番と同じ lib/sync/eslove*.ts をそのまま使用し、
 * 実行結果は sync_jobs に記録されるので管理画面の「同期履歴」からも確認できる。
 *
 * 【使い方】（プロジェクトフォルダで実行）
 *   npx tsx scripts/sync-eslove-local.ts              # キャスト情報 + 出勤情報の両方
 *   npx tsx scripts/sync-eslove-local.ts therapists   # キャスト情報のみ
 *   npx tsx scripts/sync-eslove-local.ts shifts       # 出勤情報のみ（今日から14日間）
 */
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const mode = (process.argv[2] || 'all') as 'all' | 'therapists' | 'shifts';
  if (!['all', 'therapists', 'shifts'].includes(mode)) {
    console.error('使い方: npx tsx scripts/sync-eslove-local.ts [all|therapists|shifts]');
    process.exit(1);
  }

  // dotenv読み込み後にインポートする（モジュールがimport時に環境変数を読むため）
  const { supabaseAdmin: supabase } = await import('../lib/supabaseAdmin');
  const { getEsloveCredentials, PORTAL_CREDENTIAL_COLUMNS } = await import('../lib/sync/portal-credentials');
  const { fetchTherapistsFromEslove, syncShiftsToEslove } = await import('../lib/sync/eslove');
  const { syncTherapistToEslove } = await import('../lib/sync/eslove-therapist');
  const { createSyncJob, completeSyncJob } = await import('../lib/sync/sync-job');

  // エステラブの認証情報が設定されている店舗を取得
  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select(`id, name, ${PORTAL_CREDENTIAL_COLUMNS}`)
    .not('eslove_login_id', 'is', null);

  if (shopsError) throw shopsError;

  const targetShops = (shops || []).filter((s: any) => getEsloveCredentials(s));
  if (targetShops.length === 0) {
    console.log('エステラブのログイン情報が設定されている店舗がありません。');
    return;
  }

  for (const shop of targetShops as any[]) {
    const creds = getEsloveCredentials(shop)!;
    console.log(`\n===== ${shop.name} =====`);

    // ---- 1. キャスト情報の同期 ----
    if (mode === 'all' || mode === 'therapists') {
      const jobId = await createSyncJob(shop.id, 'therapist_batch');

      const { data: therapists } = await supabase
        .from('therapists')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .order('order', { ascending: true });

      if (!therapists || therapists.length === 0) {
        console.log('同期対象のキャストがいません。');
        if (jobId) await completeSyncJob(jobId, 'completed', { successCount: 0, errorCount: 0, details: [], targetSite: 'eslove' });
      } else {
        console.log(`キャスト${therapists.length}人を同期します...`);

        // ポータル側の既存プロフィール一覧を取得して名前で紐付け（重複登録防止）
        const normalize = (n: string) => n.replace(/\s+/g, '').toLowerCase();
        let portalNameMap = new Map<string, string>();
        try {
          const portalTherapists = await fetchTherapistsFromEslove(creds.loginUrl, creds.loginId, creds.password);
          // 同名の重複プロフィールがある場合、一覧の表示順で先に現れた方（実際に使われている方）を優先する
          for (const t of portalTherapists) {
            const key = normalize(t.name);
            if (!portalNameMap.has(key)) portalNameMap.set(key, t.id);
          }
          console.log(`ポータル側に既存プロフィール${portalTherapists.length}件を確認。`);
        } catch (e: any) {
          console.warn('ポータル側一覧の取得に失敗（未紐付けキャストは新規登録になります）:', e.message);
        }

        let successCount = 0;
        let errorCount = 0;
        const details: any[] = [];

        for (let i = 0; i < therapists.length; i++) {
          const therapist = therapists[i];

          const { data: photos } = await supabase
            .from('therapist_photos')
            .select('photo_url')
            .eq('therapist_id', therapist.id)
            .order('display_order', { ascending: true });

          const photoUrls = (photos && photos.length > 0)
            ? photos.map((p: any) => p.photo_url)
            : (therapist.photo_url ? [therapist.photo_url] : []);

          const therapistWithPhotos = {
            ...therapist,
            photos: photos || [],
            photo_urls: photoUrls,
            photo_url: photoUrls[0] || null,
          };

          let esloveId = therapist.eslove_therapist_id;
          if (!esloveId) {
            const matched = portalNameMap.get(normalize(therapist.name));
            if (matched) {
              esloveId = matched;
              await supabase.from('therapists').update({ eslove_therapist_id: esloveId }).eq('id', therapist.id);
            }
          }

          process.stdout.write(`[${i + 1}/${therapists.length}] ${therapist.name} ... `);
          const res = await syncTherapistToEslove(creds.loginUrl, creds.loginId, creds.password, therapistWithPhotos, esloveId);

          if (res.success) {
            if (res.newId && String(res.newId) !== String(esloveId)) {
              await supabase.from('therapists').update({ eslove_therapist_id: String(res.newId) }).eq('id', therapist.id);
            }
            successCount++;
            details.push({ id: therapist.id, name: therapist.name, success: true });
            console.log('OK');
          } else {
            errorCount++;
            details.push({ id: therapist.id, name: therapist.name, success: false, error: res.error });
            console.log('失敗:', res.error);
          }

          if (i < therapists.length - 1) await new Promise(r => setTimeout(r, 2000));
        }

        console.log(`キャスト同期完了: 成功${successCount}人 / 失敗${errorCount}人`);
        if (jobId) {
          await completeSyncJob(jobId, errorCount === 0 ? 'completed' : 'failed', {
            successCount, errorCount, details, targetSite: 'eslove',
          });
        }
      }
    }

    // ---- 2. 出勤情報の同期（今日から14日間） ----
    if (mode === 'all' || mode === 'shifts') {
      const jobId = await createSyncJob(shop.id, 'shift_manual');

      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const future = new Date(today);
      future.setDate(future.getDate() + 13);
      const endDate = future.toISOString().split('T')[0];

      const { data: shifts } = await supabase
        .from('shifts')
        .select(`date, start_time, end_time, therapists!inner ( id, name, eslove_therapist_id )`)
        .eq('shop_id', shop.id)
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: activeTherapists } = await supabase
        .from('therapists')
        .select('id, name, eslove_therapist_id')
        .eq('shop_id', shop.id)
        .not('eslove_therapist_id', 'is', null);

      console.log(`出勤情報を同期します（${startDate} 〜 ${endDate}、シフト${shifts?.length || 0}件）...`);
      const result = await syncShiftsToEslove(
        creds.loginUrl, creds.loginId, creds.password,
        startDate, endDate, shifts || [], activeTherapists || []
      );

      if (result.success) {
        console.log('出勤情報の同期完了:', result.message);
        if (jobId) await completeSyncJob(jobId, 'completed', { message: result.message, target: 'eslove', details: result.details });
      } else {
        console.error('出勤情報の同期失敗:', result.error);
        if (jobId) await completeSyncJob(jobId, 'failed', { error: `同期エラー: ${result.error}` });
      }
    }
  }

  console.log('\nすべての処理が完了しました。管理画面の「同期履歴」からも確認できます。');
}

main().catch(e => {
  console.error('エラーが発生しました:', e);
  process.exit(1);
});
