import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { isRealTherapist } from '@/lib/sync/filter-therapists';
import { syncShiftsToEstama } from '@/lib/sync/estama';
import { createSyncJob, completeSyncJob } from '@/lib/sync/sync-job';
import { getEstamaCredentials } from '@/lib/sync/portal-credentials';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro limit

export async function GET(req: Request) {
  try {
    // 1. 同期が必要な店舗（needs_sync = true）を取得
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('*')
      .eq('needs_sync', true);

    if (shopsError) throw shopsError;
    if (!shops || shops.length === 0) {
      return NextResponse.json({ success: true, message: 'No shops require syncing.' });
    }

    console.log(`Found ${shops.length} shops requiring urgent sync.`);

    // 2. 先に needs_sync を false に戻す（重複実行を防ぐため）
    const shopIds = shops.map(s => s.id);
    await supabase
      .from('shops')
      .update({ needs_sync: false })
      .in('id', shopIds);

    // 3. 対象期間（今日から14日間）を計算
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const future = new Date(today);
    future.setDate(future.getDate() + 13);
    const endDate = future.toISOString().split('T')[0];

    // 4. 各店舗ごとに同期処理を直列で実行（メモリ不足・並列実行エラーを防ぐため）
    const results = [];
    for (const shop of shops) {
      let estamaResult: { success: boolean; error?: string; message?: string } | null = null;

      // ジョブを作成
      const jobId = await createSyncJob(shop.id, 'cron_urgent_reserve');

      // シフトの取得
      const { data: shifts } = await supabase
        .from('shifts')
        .select(`
          id,
          therapist_id,
          start_time,
          end_time,
          date,
          therapists!inner (
            id,
            name,
            estama_therapist_id
          )
        `)
        .eq('shop_id', shop.id)
        .gte('date', startDate)
        .lte('date', endDate);

      // 予約の取得
      const { data: reservations } = await supabase
        .from('reservations')
        .select(`
          id,
          therapist_id,
          start_time,
          end_time,
          date
        `)
        .eq('shop_id', shop.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .neq('status', 'cancelled');

      // アクティブなセラピストの取得 (エステ魂連携IDを持つ全セラピスト)
      const { data: activeTherapists } = await supabase
        .from('therapists')
        .select('id, name, estama_therapist_id')
        .eq('shop_id', shop.id)
        .not('estama_therapist_id', 'is', null);

      const filteredShifts = (shifts || []).filter((s: any) => isRealTherapist(s.therapists?.name));
      const filteredTherapists = (activeTherapists || []).filter((t: any) => isRealTherapist(t.name));

      // エステ魂の同期
      const estamaCreds = getEstamaCredentials(shop);
      if (estamaCreds) {
        try {
          estamaResult = await syncShiftsToEstama(
            estamaCreds.loginUrl,
            estamaCreds.loginId,
            estamaCreds.password,
            startDate,
            endDate,
            filteredShifts,
            reservations || [],
            filteredTherapists
          );
        } catch (e: any) {
          console.error(`Estama Sync Error for shop ${shop.id}:`, e);
          estamaResult = { success: false, error: e.message };
        }
      }

      // メンズエステランキングとエステラブは、この5分毎の緊急同期では同期しない。
      //
      // 【理由】
      // この処理の目的は「予約が入った直後に案内状況(×)をポータルへ反映する」ことだが、
      // その受け皿があるのはエステ魂だけで、両サイトにはセラピスト個別の予約状況を
      // 登録する仕組みがない（送っているのは出勤情報のみ）。
      // つまり5分毎に叩いても得られるものが無い一方、日中はサイト側のアクセス制限に
      // 頻繁に阻まれており（実測でランキングの成功率は15時台で30%）、
      // 失敗ログを量産するだけになっていた。
      // 出勤情報は cron/sync-daily の深夜1回（JST 3:00）にまとめて同期する。

      if (jobId) {
        const isSuccess = !estamaResult || estamaResult.success;
        await completeSyncJob(jobId, isSuccess ? 'completed' : 'failed', {
          estama: estamaResult,
        });
      }

      results.push({ shopId: shop.id, estamaResult });
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error('Cron Urgent Sync Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
