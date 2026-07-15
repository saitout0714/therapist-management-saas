import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Assuming service role or similar is set up, or standard client
import { syncShiftsToEstheRanking } from '@/lib/sync/esthe-ranking';

export const maxDuration = 60; // Vercel timeout対策 (最大60秒)

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { shopId, startDate, endDate } = body;

    if (!shopId || !startDate || !endDate) {
      return NextResponse.json({ error: 'shopId と startDate, endDate は必須です' }, { status: 400 });
    }

    // 期間のバリデーション（最大14日）
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 14) {
      return NextResponse.json({ error: '一度に同期できるのは最大14日間までです' }, { status: 400 });
    }

    // 1. 店舗のログイン情報を取得
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('esthe_ranking_login_id, esthe_ranking_password, esthe_ranking_shop_url')
      .eq('id', shopId)
      .single();

    if (shopError || !shop) {
      return NextResponse.json({ error: '店舗情報の取得に失敗しました' }, { status: 500 });
    }

    if (!shop.esthe_ranking_shop_url || !shop.esthe_ranking_login_id || !shop.esthe_ranking_password) {
      return NextResponse.json({ error: '店舗設定画面でメンズエステランキングのログイン情報（URL, ID, パスワード）を設定してください' }, { status: 400 });
    }

    // 2. 指定日の出勤情報を取得 (シフト ＆ セラピストの連携ID)
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select(`
        start_time,
        end_time,
        therapists!inner (
          id,
          name,
          esthe_ranking_therapist_id
        )
      `)
      .eq('shop_id', shopId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (shiftsError) {
      return NextResponse.json({ error: 'シフト情報の取得に失敗しました' }, { status: 500 });
    }

    // 3. Playwrightスクリプトを実行して同期
    // ※Vercel等のサーバーレス環境ではPlaywrightの実行に時間がかかる場合があるため、
    // 本来は非同期バックグラウンドジョブ（InngestやSQS等）にキューイングするのが望ましいです。
    // 今回はプレースホルダーとして直接呼び出します。
    const result = await syncShiftsToEstheRanking(
      shop.esthe_ranking_shop_url,
      shop.esthe_ranking_login_id,
      shop.esthe_ranking_password,
      startDate,
      endDate,
      shifts || []
    );

    if (!result.success) {
      return NextResponse.json({ error: `同期エラー: ${result.error}` }, { status: 500 });
    }

    return NextResponse.json({ message: result.message || '同期が完了しました' });

  } catch (error: any) {
    console.error('Esthe Ranking Sync API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
