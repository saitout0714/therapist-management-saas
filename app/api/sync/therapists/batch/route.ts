import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { syncTherapistToEstama } from '@/lib/sync/estama-therapist';
import { syncTherapistToEstheRanking } from '@/lib/sync/esthe-ranking-therapist';
import { syncTherapistToEslove } from '@/lib/sync/eslove-therapist';
import { fetchTherapistsFromEstama } from '@/lib/sync/estama';
import { fetchTherapistsFromEstheRanking } from '@/lib/sync/esthe-ranking';
import { fetchTherapistsFromEslove } from '@/lib/sync/eslove';
import { createSyncJob, completeSyncJob } from '@/lib/sync/sync-job';
import { getEstamaCredentials, getEstheRankingCredentials, getEsloveCredentials } from '@/lib/sync/portal-credentials';

function normalizeTherapistName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

function buildPortalNameMap(portalTherapists: { id: string; name: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of portalTherapists) {
    // ポータル側に同名の重複プロフィールが存在することがある。一覧は表示順に並んでいるため、
    // 先に現れたもの（＝実際に使われている方）を優先し、後から来た古い重複で上書きしない。
    const key = normalizeTherapistName(t.name);
    if (!map.has(key)) map.set(key, t.id);
  }
  return map;
}

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { shopId, therapistIds, targetSite } = await req.json(); // targetSite: 'estama' | 'esthe_ranking' | 'eslove'
    if (!shopId || !therapistIds || !Array.isArray(therapistIds) || therapistIds.length === 0) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. 同期ジョブを作成
    const jobId = await createSyncJob(shopId, 'therapist_batch');
    if (!jobId) {
      return NextResponse.json({ error: 'Failed to create sync job' }, { status: 500 });
    }

    // 2. バックグラウンド処理を登録
    after(async () => {
      try {
        const { data: shop, error: shopError } = await supabase
          .from('shops')
          .select('*')
          .eq('id', shopId)
          .single();

        if (shopError || !shop) {
          await completeSyncJob(jobId, 'failed', { error: '店舗情報の取得に失敗しました。' });
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        const details: any[] = [];

        // 連携ID未設定のキャストがいる場合、新規登録前に一度だけポータル側の
        // 既存プロフィール一覧を取得し、名前が一致すればそちらに紐付ける
        // （重複プロフィール作成を防ぐ）。取得に失敗しても従来通り新規登録に
        // フォールバックするだけなので、ここでの失敗はバッチ全体を止めない。
        const estamaCreds = getEstamaCredentials(shop);
        const erCreds = getEstheRankingCredentials(shop);
        const esloveCreds = getEsloveCredentials(shop);

        let portalNameMap: Map<string, string> | null = null;
        const idField = targetSite === 'estama' ? 'estama_therapist_id' : targetSite === 'eslove' ? 'eslove_therapist_id' : 'esthe_ranking_therapist_id';
        const { data: unlinkedCheck } = await supabase
          .from('therapists')
          .select('id')
          .in('id', therapistIds)
          .is(idField, null);

        if (unlinkedCheck && unlinkedCheck.length > 0) {
          try {
            if (targetSite === 'estama' && estamaCreds) {
              const portalTherapists = await fetchTherapistsFromEstama(estamaCreds.loginUrl, estamaCreds.loginId, estamaCreds.password);
              portalNameMap = buildPortalNameMap(portalTherapists);
            } else if (targetSite === 'eslove' && esloveCreds) {
              const portalTherapists = await fetchTherapistsFromEslove(esloveCreds.loginUrl, esloveCreds.loginId, esloveCreds.password);
              portalNameMap = buildPortalNameMap(portalTherapists);
            } else if (targetSite === 'esthe_ranking' && erCreds) {
              const portalTherapists = await fetchTherapistsFromEstheRanking(erCreds.loginUrl, erCreds.loginId, erCreds.password);
              portalNameMap = buildPortalNameMap(portalTherapists);
            }
          } catch (e: any) {
            console.error('Batch Therapist Sync: failed to pre-fetch portal therapist list, falling back to create-new for unlinked casts:', e);
          }
        }

        for (let i = 0; i < therapistIds.length; i++) {
          const therapistId = therapistIds[i];
          const { data: therapist } = await supabase
            .from('therapists')
            .select('*')
            .eq('id', therapistId)
            .single();

          if (!therapist) {
            errorCount++;
            details.push({ id: therapistId, success: false, error: 'Not found' });
            continue;
          }

          const { data: photos } = await supabase
            .from('therapist_photos')
            .select('photo_url')
            .eq('therapist_id', therapistId)
            .order('display_order', { ascending: true });

          const photoUrls = (photos && photos.length > 0)
            ? photos.map((p: any) => p.photo_url)
            : (therapist.photo_url ? [therapist.photo_url] : []);

          const therapistWithPhotos = {
            ...therapist,
            photos: photos || [],
            photo_urls: photoUrls,
            photo_url: photoUrls[0] || null
          };

          let res: any;
          if (targetSite === 'estama') {
            if (!estamaCreds) {
              await completeSyncJob(jobId, 'failed', { error: 'ログイン情報未設定' });
              return;
            }
            let estamaId = therapist.estama_therapist_id;
            if (!estamaId && portalNameMap) {
              const matched = portalNameMap.get(normalizeTherapistName(therapist.name));
              if (matched) {
                estamaId = matched;
                await supabase.from('therapists').update({ estama_therapist_id: estamaId }).eq('id', therapist.id);
              }
            }
            res = await syncTherapistToEstama(
              estamaCreds.loginUrl, estamaCreds.loginId, estamaCreds.password, therapistWithPhotos, estamaId
            );
            if (res.success && res.newId && String(res.newId) !== String(estamaId)) {
              await supabase.from('therapists').update({ estama_therapist_id: String(res.newId) }).eq('id', therapist.id);
            }
          } else if (targetSite === 'eslove') {
            if (!esloveCreds) {
              await completeSyncJob(jobId, 'failed', { error: 'ログイン情報未設定' });
              return;
            }
            let esloveId = therapist.eslove_therapist_id;
            if (!esloveId && portalNameMap) {
              const matched = portalNameMap.get(normalizeTherapistName(therapist.name));
              if (matched) {
                esloveId = matched;
                await supabase.from('therapists').update({ eslove_therapist_id: esloveId }).eq('id', therapist.id);
              }
            }
            res = await syncTherapistToEslove(
              esloveCreds.loginUrl, esloveCreds.loginId, esloveCreds.password, therapistWithPhotos, esloveId
            );
            if (res.success && res.newId && String(res.newId) !== String(esloveId)) {
              await supabase.from('therapists').update({ eslove_therapist_id: String(res.newId) }).eq('id', therapist.id);
            }
          } else {
            if (!erCreds) {
              await completeSyncJob(jobId, 'failed', { error: 'ログイン情報未設定' });
              return;
            }
            let rankingId = therapist.esthe_ranking_therapist_id;
            if (!rankingId && portalNameMap) {
              const matched = portalNameMap.get(normalizeTherapistName(therapist.name));
              if (matched) {
                rankingId = matched;
                await supabase.from('therapists').update({ esthe_ranking_therapist_id: rankingId }).eq('id', therapist.id);
              }
            }
            res = await syncTherapistToEstheRanking(
              erCreds.loginUrl, erCreds.loginId, erCreds.password, therapistWithPhotos, rankingId
            );
            if (res.success && res.newId && String(res.newId) !== String(rankingId)) {
              await supabase.from('therapists').update({ esthe_ranking_therapist_id: String(res.newId) }).eq('id', therapist.id);
            }
          }

          if (res.success) {
            successCount++;
            details.push({ id: therapistId, name: therapist.name, success: true });
          } else {
            errorCount++;
            details.push({ id: therapistId, name: therapist.name, success: false, error: res.error });
          }

          if (i < therapistIds.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        const isFullySuccess = errorCount === 0;
        await completeSyncJob(jobId, isFullySuccess ? 'completed' : 'failed', {
          successCount,
          errorCount,
          details,
          targetSite
        });

      } catch (error: any) {
        console.error('Batch Therapist Sync Error (Background):', error);
        await completeSyncJob(jobId, 'failed', { error: error.message || 'サーバーエラーが発生しました。' });
      }
    });

    // 3. 即座にレスポンスを返す
    return NextResponse.json({ success: true, message: 'バックグラウンドで一括同期を開始しました。', jobId });
  } catch (error: any) {
    console.error('Batch Therapist Sync API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
