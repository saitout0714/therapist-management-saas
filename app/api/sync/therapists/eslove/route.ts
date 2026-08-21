import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { syncTherapistToEslove } from '@/lib/sync/eslove-therapist';
import { findExistingEsloveIdByName } from '@/lib/sync/eslove';
import { getEsloveCredentials, PORTAL_CREDENTIAL_COLUMNS } from '@/lib/sync/portal-credentials';
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
          .select(PORTAL_CREDENTIAL_COLUMNS)
          .eq('id', shopId)
          .single();

        const esloveCreds = shopError ? null : getEsloveCredentials(shop);
        if (!esloveCreds) {
          await completeSyncJob(jobId, 'failed', { error: 'エステラブのログイン情報が設定されていません。' });
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

        let esloveId = therapist.eslove_therapist_id;
        if (!esloveId) {
          esloveId = await findExistingEsloveIdByName(
            esloveCreds.loginUrl,
            esloveCreds.loginId,
            esloveCreds.password,
            therapist.name
          );
          if (esloveId) {
            await supabase.from('therapists').update({ eslove_therapist_id: esloveId }).eq('id', therapist.id);
          }
        }

        const result = await syncTherapistToEslove(
          esloveCreds.loginUrl,
          esloveCreds.loginId,
          esloveCreds.password,
          therapistWithPhotos,
          esloveId
        );

        if (!result.success) {
          await completeSyncJob(jobId, 'failed', { error: result.error || '同期に失敗しました。' });
          return;
        }

        if (result.newId && String(result.newId) !== String(therapist.eslove_therapist_id)) {
          await supabase
            .from('therapists')
            .update({ eslove_therapist_id: String(result.newId) })
            .eq('id', therapist.id);
        }

        await completeSyncJob(jobId, 'completed', { message: 'エステラブへのセラピスト同期が完了しました。', target: 'eslove' });
      } catch (error: any) {
        console.error('Eslove Therapist Sync Error (Background):', error);
        await completeSyncJob(jobId, 'failed', { error: error.message || 'サーバーエラーが発生しました。' });
      }
    });

    // 3. 即座にレスポンスを返す
    return NextResponse.json({ success: true, message: 'バックグラウンドでエステラブへの同期を開始しました。', jobId });
  } catch (error: any) {
    console.error('Eslove Therapist Sync Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
