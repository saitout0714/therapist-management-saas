/**
 * メンズエステランキング同期のローカル実行スクリプト
 *
 * 【なぜこのスクリプトがあるか】
 * メンズエステランキングは本番サーバー(Vercel)のIPからのアクセスを403 Forbiddenで
 * 高確率でブロックしている。さくら経由の中継も、さくらのIPからのTCP接続自体が
 * 応答なしになるため使えない(エステラブとは遮断のされ方が異なる)。
 * 一方、店舗のPC（通常の回線）からはブロックされずアクセスできるため、
 * このスクリプトをローカルで実行することで同期を行う。
 * 同期ロジック本体は本番と同じ lib/sync/esthe-ranking*.ts をそのまま使用し、
 * 実行結果は sync_jobs に記録されるので管理画面の「同期履歴」からも確認できる。
 *
 * 【使い方】（プロジェクトフォルダで実行）
 *   npx tsx scripts/sync-esthe-ranking-local.ts              # キャスト情報 + 出勤情報の両方
 *   npx tsx scripts/sync-esthe-ranking-local.ts therapists   # キャスト情報のみ
 *   npx tsx scripts/sync-esthe-ranking-local.ts shifts       # 出勤情報のみ（今日から14日間）
 *   npx tsx scripts/sync-esthe-ranking-local.ts shifts 2026-08-20 2026-09-02
 *                                                     # 期間を指定して出勤情報を同期
 */
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const mode = (process.argv[2] || 'all') as 'all' | 'therapists' | 'shifts';
  if (!['all', 'therapists', 'shifts'].includes(mode)) {
    console.error('使い方: npx tsx scripts/sync-esthe-ranking-local.ts [all|therapists|shifts]');
    process.exit(1);
  }

  // dotenv読み込み後にインポートする（モジュールがimport時に環境変数を読むため）
  const { supabaseAdmin: supabase } = await import('../lib/supabaseAdmin');
  const { getEstheRankingCredentials, PORTAL_CREDENTIAL_COLUMNS } = await import('../lib/sync/portal-credentials');
  const { fetchTherapistsFromEstheRanking, syncShiftsToEstheRanking } = await import('../lib/sync/esthe-ranking');
  const { syncTherapistToEstheRanking } = await import('../lib/sync/esthe-ranking-therapist');
  const { createSyncJob, completeSyncJob } = await import('../lib/sync/sync-job');
  const { isRealTherapist } = await import('../lib/sync/filter-therapists');

  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select(`id, name, ${PORTAL_CREDENTIAL_COLUMNS}`)
    .not('esthe_ranking_login_id', 'is', null);

  if (shopsError) throw shopsError;

  const targetShops = (shops || []).filter((s: any) => getEstheRankingCredentials(s));
  if (targetShops.length === 0) {
    console.log('メンズエステランキングのログイン情報が設定されている店舗がありません。');
    return;
  }

  for (const shop of targetShops as any[]) {
    const creds = getEstheRankingCredentials(shop)!;
    console.log(`\n===== ${shop.name} =====`);

    // ---- 1. キャスト情報の同期 ----
    if (mode === 'all' || mode === 'therapists') {
      const jobId = await createSyncJob(shop.id, 'therapist_batch');

      const { data: rawTherapists } = await supabase
        .from('therapists')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .order('order', { ascending: true });

      const therapists = (rawTherapists || []).filter((t: any) => isRealTherapist(t.name));

      if (!therapists || therapists.length === 0) {
        console.log('同期対象のキャストがいません。');
        if (jobId) await completeSyncJob(jobId, 'completed', { successCount: 0, errorCount: 0, details: [], targetSite: 'esthe_ranking' });
      } else {
        console.log(`キャスト${therapists.length}人を同期します...`);

        const normalize = (n: string) => n.replace(/\s+/g, '').toLowerCase();
        let portalNameMap = new Map<string, string>();
        try {
          const portalTherapists = await fetchTherapistsFromEstheRanking(creds.loginUrl, creds.loginId, creds.password);
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

          let rankingId = therapist.esthe_ranking_therapist_id;
          if (!rankingId) {
            const matched = portalNameMap.get(normalize(therapist.name));
            if (matched) {
              rankingId = matched;
              await supabase.from('therapists').update({ esthe_ranking_therapist_id: rankingId }).eq('id', therapist.id);
            }
          }

          process.stdout.write(`[${i + 1}/${therapists.length}] ${therapist.name} ... `);
          const res = await syncTherapistToEstheRanking(creds.loginUrl, creds.loginId, creds.password, therapist, rankingId);

          if (res.success) {
            if (res.newId && String(res.newId) !== String(rankingId)) {
              await supabase.from('therapists').update({ esthe_ranking_therapist_id: String(res.newId) }).eq('id', therapist.id);
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
            successCount, errorCount, details, targetSite: 'esthe_ranking',
          });
        }
      }
    }

    // ---- 2. 出勤情報の同期（今日から14日間） ----
    if (mode === 'all' || mode === 'shifts') {
      const jobId = await createSyncJob(shop.id, 'shift_manual');

      const argDates = process.argv.slice(3).filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
      let startDate: string;
      let endDate: string;
      if (argDates.length === 2) {
        [startDate, endDate] = argDates;
      } else {
        const today = new Date();
        startDate = today.toISOString().split('T')[0];
        const future = new Date(today);
        future.setDate(future.getDate() + 13);
        endDate = future.toISOString().split('T')[0];
      }

      const { data: shifts } = await supabase
        .from('shifts')
        .select(`date, start_time, end_time, therapists!inner ( id, name, esthe_ranking_therapist_id )`)
        .eq('shop_id', shop.id)
        .gte('date', startDate)
        .lte('date', endDate);

      const filteredShifts = (shifts || []).filter((s: any) => isRealTherapist(s.therapists?.name));

      console.log(`出勤情報を同期します（${startDate} 〜 ${endDate}、シフト${filteredShifts.length}件）...`);
      const result = await syncShiftsToEstheRanking(creds.loginUrl, creds.loginId, creds.password, startDate, endDate, filteredShifts);

      if (result.success) {
        console.log('出勤情報の同期完了:', result.message);
        if (jobId) await completeSyncJob(jobId, 'completed', { message: result.message, target: 'esthe_ranking' });
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
