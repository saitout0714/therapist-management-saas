import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Supabase Webhookのペイロードからshop_idを取得
    let shopId = null;
    if (body.type === 'DELETE' && body.old_record) {
      shopId = body.old_record.shop_id;
    } else if (body.record) {
      shopId = body.record.shop_id;
    }

    if (!shopId) {
      console.warn('Webhook received but no shop_id found:', body);
      return NextResponse.json({ success: false, error: 'shop_id not found' }, { status: 400 });
    }

    console.log(`Setting needs_sync=true for shop: ${shopId}`);
    
    // 対象店舗の needs_sync を true に更新
    const { error } = await supabase
      .from('shops')
      .update({ needs_sync: true })
      .eq('id', shopId);

    if (error) {
      console.error('Failed to update needs_sync:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
