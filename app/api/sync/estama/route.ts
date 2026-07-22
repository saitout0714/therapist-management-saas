import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { syncShiftsToEstama } from '@/lib/sync/estama';

export const maxDuration = 300; // Vercel Pro timeout (max 300s)
export const dynamic = 'force-dynamic';

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
      .select('estama_login_id, estama_password, estama_shop_url')
      .eq('id', shopId)
      .single();

    if (shopError || !shop) {
      return NextResponse.json({ error: '店舗情報の取得に失敗しました' }, { status: 500 });
    }

    if (!shop.estama_login_id || !shop.estama_password) {
      return NextResponse.json({ error: '店舗設定画面でエステ魂のログイン情報（ID, パスワード）を設定してください' }, { status: 400 });
    }

    const shopUrl = shop.estama_shop_url || 'https://estama.jp/login/?r=/admin/';

    // 2. 指定日の出勤情報を取得 (シフト ＆ セラピストの連携ID)
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select(`
        date,
        start_time,
        end_time,
        therapists!inner (
          id,
          name,
          estama_therapist_id
        )
      `)
      .eq('shop_id', shopId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (shiftsError) {
      return NextResponse.json({ error: 'シフト情報の取得に失敗しました' }, { status: 500 });
    }

    // 3. 予約情報を取得
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select(`
        id,
        therapist_id,
        start_time,
        end_time,
        date
      `)
      .eq('shop_id', shopId)
      .gte('date', startDate)
      .lte('date', endDate)
      .neq('status', 'cancelled'); // キャンセル以外の予約を取得

    if (reservationsError) {
      console.warn('予約情報の取得に失敗しました:', reservationsError);
    }

    // 3.5 アクティブなセラピストの取得 (エステ魂連携IDを持つ全セラピスト)
    const { data: activeTherapists } = await supabase
      .from('therapists')
      .select('id, name, estama_therapist_id')
      .eq('shop_id', shopId)
      .not('estama_therapist_id', 'is', null);

    // 4. Playwrightスクリプトを実行して同期
    const result = await syncShiftsToEstama(
      shopUrl,
      shop.estama_login_id,
      shop.estama_password,
      startDate,
      endDate,
      shifts || [],
      reservations || [],
      activeTherapists || []
    );

    if (!result.success) {
      return NextResponse.json({ error: `同期エラー: ${result.error}` }, { status: 500 });
    }

    return NextResponse.json({ message: result.message || '同期が完了しました' });

  } catch (error: any) {
    console.error('Estama Sync API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
