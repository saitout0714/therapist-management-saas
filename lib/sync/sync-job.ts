import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export type SyncJobStatus = 'processing' | 'completed' | 'failed';
export type SyncJobType = 'therapist_single' | 'therapist_batch' | 'shift_manual' | 'cron_urgent_reserve' | 'cron_daily_shift';

/**
 * 新しい同期ジョブを作成する
 */
export async function createSyncJob(
  shopId: string,
  targetType: SyncJobType,
  therapistId?: string
): Promise<string | null> {
  try {
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
