import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { syncTherapistToEstama } from '@/lib/sync/estama-therapist';
import { syncTherapistToEstheRanking } from '@/lib/sync/esthe-ranking-therapist';
import { createSyncJob, completeSyncJob } from '@/lib/sync/sync-job';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { shopId, therapistIds, targetSite } = await req.json(); // targetSite: 'estama' | 'esthe_ranking'
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
            if (!shop.estama_login_id || !shop.estama_password) {
              await completeSyncJob(jobId, 'failed', { error: 'ログイン情報未設定' });
              return;
            }
            res = await syncTherapistToEstama(
              'https://estama.jp/', shop.estama_login_id, shop.estama_password, therapistWithPhotos, therapist.estama_therapist_id
            );
            if (res.success && res.newId && String(res.newId) !== String(therapist.estama_therapist_id)) {
              await supabase.from('therapists').update({ estama_therapist_id: String(res.newId) }).eq('id', therapist.id);
            }
          } else {
            if (!shop.esthe_ranking_login_id || !shop.esthe_ranking_password) {
              await completeSyncJob(jobId, 'failed', { error: 'ログイン情報未設定' });
              return;
            }
            res = await syncTherapistToEstheRanking(
              shop.esthe_ranking_shop_url || '', shop.esthe_ranking_login_id, shop.esthe_ranking_password, therapistWithPhotos, therapist.esthe_ranking_therapist_id
            );
            if (res.success && res.newId && String(res.newId) !== String(therapist.esthe_ranking_therapist_id)) {
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
