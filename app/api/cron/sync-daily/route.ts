import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { syncShiftsToEstama } from '@/lib/sync/estama';
import { syncShiftsToEstheRanking } from '@/lib/sync/esthe-ranking';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro limit

export async function GET(req: Request) {
  try {
    // 1. 全店舗を取得
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('*');

    if (shopsError) throw shopsError;
    if (!shops || shops.length === 0) {
      return NextResponse.json({ success: true, message: 'No shops found.' });
    }

    // 認証情報が設定されている店舗のみフィルタリング
    const targetShops = shops.filter(shop => 
      (shop.estama_login_id && shop.estama_password) || 
      (shop.esthe_ranking_login_id && shop.esthe_ranking_password)
    );

    console.log(`Found ${targetShops.length} shops for daily full sync.`);

    // 2. 対象期間（今日から14日間）を計算
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const future = new Date(today);
    future.setDate(future.getDate() + 13);
    const endDate = future.toISOString().split('T')[0];

    // 3. 各店舗ごとに同期処理を実行
    const results = await Promise.allSettled(
      targetShops.map(async (shop) => {
        let estamaResult = null;
        let estheRankingResult = null;

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
              estama_therapist_id,
              esthe_ranking_therapist_id
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

        // エステ魂の同期
        if (shop.estama_login_id && shop.estama_password) {
          const shopUrl = shop.hp_url || 'https://estama.jp/admin/schedule/';
          try {
            estamaResult = await syncShiftsToEstama(
              shopUrl,
              shop.estama_login_id,
              shop.estama_password,
              startDate,
              endDate,
              shifts || [],
              reservations || []
            );
          } catch (e: any) {
            console.error(`Daily Estama Sync Error for shop ${shop.id}:`, e);
            estamaResult = { success: false, error: e.message };
          }
        }

        // メンズエステランキングの同期
        if (shop.esthe_ranking_login_id && shop.esthe_ranking_password) {
          try {
            estheRankingResult = await syncShiftsToEstheRanking(
              shop.esthe_ranking_login_id,
              shop.esthe_ranking_password,
              startDate,
              endDate,
              shifts || [],
              reservations || []
            );
          } catch (e: any) {
            console.error(`Daily EstheRanking Sync Error for shop ${shop.id}:`, e);
            estheRankingResult = { success: false, error: e.message };
          }
        }

        return { shopId: shop.id, estamaResult, estheRankingResult };
      })
    );

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error('Cron Daily Sync Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
