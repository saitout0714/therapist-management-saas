import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchTherapistsFromEstheRanking } from '@/lib/sync/esthe-ranking';

export const maxDuration = 60; // Vercel timeout対策 (最大60秒)

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
      .select('esthe_ranking_login_id, esthe_ranking_password, esthe_ranking_shop_url')
      .eq('id', shopId)
      .single();

    if (shopError || !shop) {
      return NextResponse.json({ error: '店舗情報の取得に失敗しました' }, { status: 500 });
    }

    if (!shop.esthe_ranking_shop_url || !shop.esthe_ranking_login_id || !shop.esthe_ranking_password) {
      return NextResponse.json({ error: '店舗設定画面でメンズエステランキングのログイン情報を設定してください' }, { status: 400 });
    }

    // 2. yoyaklのセラピスト一覧を取得
    const { data: localTherapists, error: therapistsError } = await supabase
      .from('therapists')
      .select('id, name, esthe_ranking_therapist_id')
      .eq('shop_id', shopId)
      .eq('is_active', true);

    if (therapistsError) {
      return NextResponse.json({ error: 'セラピスト情報の取得に失敗しました' }, { status: 500 });
    }

    // 3. ランキングサイトからセラピスト一覧を取得
    const portalTherapists = await fetchTherapistsFromEstheRanking(
      shop.esthe_ranking_shop_url,
      shop.esthe_ranking_login_id,
      shop.esthe_ranking_password
    );

    // 4. 名前でマッチング
    let matchedCount = 0;
    const updates = [];

    for (const portalT of portalTherapists) {
      // 空白を削除して比較
      const normalizedPortalName = portalT.name.replace(/\s+/g, '').toLowerCase();
      
      const matchedLocal = localTherapists?.find(localT => {
        const normalizedLocalName = localT.name.replace(/\s+/g, '').toLowerCase();
        return normalizedLocalName === normalizedPortalName;
      });

      if (matchedLocal) {
        // IDが未設定、または異なる場合のみ更新
        if (matchedLocal.esthe_ranking_therapist_id !== portalT.id) {
          updates.push({
            id: matchedLocal.id,
            esthe_ranking_therapist_id: portalT.id,
          });
        }
      }
    }

    // 5. DBを更新
    for (const update of updates) {
      const { error } = await supabase
        .from('therapists')
        .update({ esthe_ranking_therapist_id: update.esthe_ranking_therapist_id })
        .eq('id', update.id);
        
      if (!error) {
        matchedCount++;
      } else {
        console.error('Failed to update therapist', update.id, error);
      }
    }

    return NextResponse.json({ 
      message: `${portalTherapists.length}人中、${matchedCount}人のセラピストIDを自動設定しました！`,
      matchedCount,
      totalPortalCount: portalTherapists.length
    });

  } catch (error: any) {
    console.error('Esthe Ranking Match API Error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
