import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { syncTherapistToEstheRanking } from '@/lib/sync/esthe-ranking-therapist';
import { createSyncJob, completeSyncJob } from '@/lib/sync/sync-job';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { shopId, therapistId } = await req.json();
    if (!shopId || !therapistId) {
      return NextResponse.json({ error: 'Missing shopId or therapistId' }, { status: 400 });
    }

    // 1. 同期ジョブを作成
    const jobId = await createSyncJob(shopId, 'therapist_single', therapistId);
    if (!jobId) {
      return NextResponse.json({ error: 'Failed to create sync job' }, { status: 500 });
    }

    // 2. バックグラウンド処理を登録
    after(async () => {
      try {
        const { data: shop, error: shopError } = await supabase
          .from('shops')
          .select('esthe_ranking_shop_url, esthe_ranking_login_id, esthe_ranking_password')
          .eq('id', shopId)
          .single();

        if (shopError || !shop || !shop.esthe_ranking_login_id || !shop.esthe_ranking_password) {
          await completeSyncJob(jobId, 'failed', { error: 'メンズエステランキングのログイン情報が設定されていません。' });
          return;
        }

        const { data: therapist, error: therapistError } = await supabase
          .from('therapists')
          .select('*')
          .eq('id', therapistId)
          .single();

        if (therapistError || !therapist) {
          await completeSyncJob(jobId, 'failed', { error: 'セラピストが見つかりません。' });
          return;
        }

        const result = await syncTherapistToEstheRanking(
          shop.esthe_ranking_shop_url || '',
          shop.esthe_ranking_login_id,
          shop.esthe_ranking_password,
          therapist,
          therapist.esthe_ranking_therapist_id
        );

        if (!result.success) {
          await completeSyncJob(jobId, 'failed', { error: result.error || '同期に失敗しました。' });
          return;
        }

        if (result.newId && String(result.newId) !== String(therapist.esthe_ranking_therapist_id)) {
          await supabase
            .from('therapists')
            .update({ esthe_ranking_therapist_id: String(result.newId) })
            .eq('id', therapist.id);
        }

        await completeSyncJob(jobId, 'completed', { message: 'メンズエステランキングへのセラピスト同期が完了しました。', target: 'esthe_ranking' });
      } catch (error: any) {
        console.error('EstheRanking Therapist Sync Error (Background):', error);
        await completeSyncJob(jobId, 'failed', { error: error.message || 'サーバーエラーが発生しました。' });
      }
    });

    // 3. 即座にレスポンスを返す
    return NextResponse.json({ success: true, message: 'バックグラウンドでメンズエステランキングへの同期を開始しました。', jobId });
  } catch (error: any) {
    console.error('EstheRanking Therapist Sync Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
