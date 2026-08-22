import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export type SyncJobStatus = 'processing' | 'completed' | 'failed';
export type SyncJobType = 'therapist_single' | 'therapist_batch' | 'shift_manual' | 'cron_urgent_reserve' | 'cron_daily_shift' | 'news_post';

/**
 * 一定時間（既定15分）以上 'processing' のまま滞留している古くなったジョブを自動的に 'failed' に更新する
 */
export async function cleanupStuckSyncJobs(timeoutMinutes: number = 15): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('sync_jobs')
      .update({
        status: 'failed',
        result_details: { error: `処理タイムアウト（${timeoutMinutes}分以上経過したため自動失敗処理されました）` }
      })
      .eq('status', 'processing')
      .lt('created_at', cutoff)
      .select('id');

    if (error) {
      console.error('[cleanupStuckSyncJobs] DB Update Error:', error);
      return 0;
    }
    const count = data?.length || 0;
    if (count > 0) {
      console.log(`[cleanupStuckSyncJobs] Cleaned up ${count} stuck jobs older than ${timeoutMinutes} minutes.`);
    }
    return count;
  } catch (err) {
    console.error('[cleanupStuckSyncJobs] Exception:', err);
    return 0;
  }
}

/**
 * 新しい同期ジョブを作成する
 */
export async function createSyncJob(
  shopId: string,
  targetType: SyncJobType,
  therapistId?: string
): Promise<string | null> {
  try {
    // 新規ジョブ作成のタイミングで滞留ジョブのクリーンアップを自動実行する
    await cleanupStuckSyncJobs(15).catch(() => {});

    const { data, error } = await supabase
      .from('sync_jobs')
      .insert({
        shop_id: shopId,
        target_type: targetType,
        therapist_id: therapistId || null,
        status: 'processing',
        result_details: {}
      })
      .select('id')
      .single();

    if (error) {
      console.error('[createSyncJob] DB Insert Error:', error);
      return null;
    }
    return data.id;
  } catch (err) {
    console.error('[createSyncJob] Exception:', err);
    return null;
  }
}

/**
 * 同期ジョブを完了（または失敗）状態に更新する
 */
export async function completeSyncJob(
  jobId: string,
  status: SyncJobStatus,
  resultDetails: any
) {
  try {
    const { error } = await supabase
      .from('sync_jobs')
      .update({
        status,
        result_details: resultDetails,
      })
      .eq('id', jobId);

    if (error) {
      console.error('[completeSyncJob] DB Update Error:', error);
    }
  } catch (err) {
    console.error('[completeSyncJob] Exception:', err);
  }
}
