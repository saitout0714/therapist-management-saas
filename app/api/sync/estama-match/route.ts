import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { fetchTherapistsFromEstama } from '@/lib/sync/estama';

export const maxDuration = 300; // Vercel Pro timeout (max 300s)

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { shopId } = body;

    if (!shopId) {
      return NextResponse.json({ error: 'shopId は必須です' }, { status: 400 });
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
      return NextResponse.json({ error: '店舗設定画面でエステ魂のログイン情報を設定してください' }, { status: 400 });
    }

    const shopUrl = shop.estama_shop_url || 'https://estama.jp/login/?r=/admin/';

    // 2. ローカルのセラピスト一覧を取得
    const { data: localTherapists, error: therapistsError } = await supabase
      .from('therapists')
      .select('id, name, estama_therapist_id')
      .eq('shop_id', shopId)
      .eq('is_active', true);

    if (therapistsError) {
      return NextResponse.json({ error: 'セラピスト情報の取得に失敗しました' }, { status: 500 });
    }

    // 3. エステ魂からセラピスト一覧を取得
    const portalTherapists = await fetchTherapistsFromEstama(
      shopUrl,
      shop.estama_login_id,
      shop.estama_password
    );

    // 4. 名前でマッチング
    let matchedCount = 0;
    const updates = [];

    for (const portalT of portalTherapists) {
      const normalizedPortalName = portalT.name.replace(/\s+/g, '').toLowerCase();
      
      const matchedLocal = localTherapists?.find(localT => {
        const normalizedLocalName = localT.name.replace(/\s+/g, '').toLowerCase();
        return normalizedLocalName === normalizedPortalName;
      });

      if (matchedLocal) {
        if (matchedLocal.estama_therapist_id !== portalT.id) {
          updates.push({
            id: matchedLocal.id,
            estama_therapist_id: portalT.id,
          });
        }
      }
    }

    // 5. DBを更新
    for (const update of updates) {
      const { error } = await supabase
        .from('therapists')
        .update({ estama_therapist_id: update.estama_therapist_id })
        .eq('id', update.id);
        
      if (!error) {
        matchedCount++;
      } else {
        console.error('Failed to update therapist', update.id, error);
      }
    }

    const msg = matchedCount > 0
      ? `エステ魂のセラピスト${portalTherapists.length}人中、${matchedCount}人のセラピストIDを新しく自動設定しました！`
      : `エステ魂から${portalTherapists.length}人のセラピストを取得しました。既に全員の連携IDが設定済みであるか、名前が一致する未設定のセラピストがいなかったため、更新対象は0件でした。`;

    return NextResponse.json({ 
      message: msg,
      matchedCount,
      totalPortalCount: portalTherapists.length
    });

  } catch (error: any) {
    console.error('Estama Match API Error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
