import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

const VALID_NEWS_TYPES = ['1', '2', '3', '4', '9'];

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shopId');
  if (!shopId) {
    return NextResponse.json({ error: 'shopId は必須です' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('news_drafts')
    .select('*')
    .eq('shop_id', shopId)
    .order('scheduled_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('News drafts fetch error:', error);
    return NextResponse.json({ error: '一覧の取得に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ drafts: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const shopId = formData.get('shopId') as string | null;
    const newsType = formData.get('newsType') as string | null;
    const title = (formData.get('title') as string | null)?.trim();
    const content = (formData.get('content') as string | null)?.trim();
    const scheduledAt = formData.get('scheduledAt') as string | null; // ISO文字列
    const image = formData.get('image') as File | null;

    if (!shopId || !newsType || !title || !content || !scheduledAt) {
      return NextResponse.json({ error: 'shopId, newsType, title, content, scheduledAt は必須です' }, { status: 400 });
    }
    if (!VALID_NEWS_TYPES.includes(newsType)) {
      return NextResponse.json({ error: '不正なニュース種別です' }, { status: 400 });
    }
    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: '予約日時が不正です' }, { status: 400 });
    }

    let imageUrl: string | null = null;
    if (image && image.size > 0) {
      if (image.size > 1024 * 1024) {
        return NextResponse.json({ error: '画像はおよそ1MB未満のjpg,pngファイルのみ保存できます' }, { status: 400 });
      }
      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = image.name.match(/\.(jpg|jpeg|png)$/i)?.[0]?.toLowerCase() || '.jpg';
      const storagePath = `news/${shopId}/${Date.now()}${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('therapist-photos')
        .upload(storagePath, buffer, { contentType: image.type || 'image/jpeg', upsert: true });
      if (uploadError) {
        console.error('News draft image upload error:', uploadError);
        return NextResponse.json({ error: '画像のアップロードに失敗しました' }, { status: 500 });
      }
      const { data: urlData } = supabase.storage.from('therapist-photos').getPublicUrl(storagePath);
      imageUrl = urlData.publicUrl;
    }

    // 同じ日（JST）に予約されている件数を確認し、上限(5件/日)超過を事前に警告する
    const jstDate = new Date(scheduledDate.getTime() + 9 * 60 * 60 * 1000);
    const dayStartJst = new Date(Date.UTC(jstDate.getUTCFullYear(), jstDate.getUTCMonth(), jstDate.getUTCDate()) - 9 * 60 * 60 * 1000);
    const dayEndJst = new Date(dayStartJst.getTime() + 24 * 60 * 60 * 1000);

    const { count } = await supabase
      .from('news_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .in('status', ['pending', 'posted'])
      .gte('scheduled_at', dayStartJst.toISOString())
      .lt('scheduled_at', dayEndJst.toISOString());

    const { data, error } = await supabase
      .from('news_drafts')
      .insert({
        shop_id: shopId,
        news_type: newsType,
        title,
        content,
        image_url: imageUrl,
        scheduled_at: scheduledDate.toISOString(),
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) {
      console.error('News draft insert error:', error);
      return NextResponse.json({ error: '予約投稿の保存に失敗しました' }, { status: 500 });
    }

    const warning = (count || 0) >= 5
      ? `同じ日にすでに${count}件の投稿が予定されています。メンズエステランキングの投稿上限は1日5回のため、超過分は投稿時にエラーになります。`
      : null;

    return NextResponse.json({ draft: data, warning });
  } catch (error: any) {
    console.error('News draft create error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
