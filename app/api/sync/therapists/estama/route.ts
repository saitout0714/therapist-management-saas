import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { syncTherapistToEstama } from '@/lib/sync/estama-therapist';
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
          .select('estama_login_id, estama_password')
          .eq('id', shopId)
          .single();

        if (shopError || !shop || !shop.estama_login_id || !shop.estama_password) {
          await completeSyncJob(jobId, 'failed', { error: 'エステ魂のログイン情報が設定されていません。' });
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

        const result = await syncTherapistToEstama(
          'https://estama.jp/',
          shop.estama_login_id,
          shop.estama_password,
          therapistWithPhotos,
          therapist.estama_therapist_id
        );

        if (!result.success) {
          await completeSyncJob(jobId, 'failed', { error: result.error || '同期に失敗しました。' });
          return;
        }

        if (result.newId && String(result.newId) !== String(therapist.estama_therapist_id)) {
          await supabase
            .from('therapists')
            .update({ estama_therapist_id: String(result.newId) })
            .eq('id', therapist.id);
        }

        await completeSyncJob(jobId, 'completed', { message: 'エステ魂へのセラピスト同期が完了しました。', target: 'estama' });
      } catch (error: any) {
        console.error('Estama Therapist Sync Error (Background):', error);
        await completeSyncJob(jobId, 'failed', { error: error.message || 'サーバーエラーが発生しました。' });
      }
    });

    // 3. 即座にレスポンスを返す
    return NextResponse.json({ success: true, message: 'バックグラウンドでエステ魂への同期を開始しました。', jobId });
  } catch (error: any) {
    console.error('Estama Therapist Sync Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
