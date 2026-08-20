import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

const VALID_NEWS_TYPES = ['1', '2', '3', '4', '9'];

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get('shopId');
  if (!shopId) {
    return NextResponse.json({ error: 'shopId は必須です' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('news_recurring_rules')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('News recurring rules fetch error:', error);
    return NextResponse.json({ error: '一覧の取得に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ rules: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const shopId = formData.get('shopId') as string | null;
    const newsType = formData.get('newsType') as string | null;
    const title = (formData.get('title') as string | null)?.trim();
    const content = (formData.get('content') as string | null)?.trim();
    const timeOfDay = formData.get('timeOfDay') as string | null; // 'HH:MM'
    const startDate = formData.get('startDate') as string | null; // 'YYYY-MM-DD'
    const endDate = formData.get('endDate') as string | null; // 'YYYY-MM-DD' | null
    const daysOfWeekRaw = formData.get('daysOfWeek') as string | null; // '0,1,2'
    const image = formData.get('image') as File | null;
    const existingImageUrl = formData.get('existingImageUrl') as string | null;

    if (!shopId || !newsType || !title || !content || !timeOfDay || !startDate || !daysOfWeekRaw) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }
    if (!VALID_NEWS_TYPES.includes(newsType)) {
      return NextResponse.json({ error: '不正なニュース種別です' }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(timeOfDay)) {
      return NextResponse.json({ error: '時刻の形式が不正です' }, { status: 400 });
    }
    const daysOfWeek = daysOfWeekRaw.split(',').map((d) => parseInt(d, 10)).filter((d) => d >= 0 && d <= 6);
    if (daysOfWeek.length === 0) {
      return NextResponse.json({ error: '曜日を1つ以上選択してください' }, { status: 400 });
    }

    let imageUrl: string | null = existingImageUrl || null;
    if (image && image.size > 0) {
      if (image.size > 1024 * 1024) {
        return NextResponse.json({ error: '画像はおよそ1MB未満のjpg,pngファイルのみ保存できます' }, { status: 400 });
      }
      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = image.name.match(/\.(jpg|jpeg|png)$/i)?.[0]?.toLowerCase() || '.jpg';
      const storagePath = `news/${shopId}/recurring_${Date.now()}${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('therapist-photos')
        .upload(storagePath, buffer, { contentType: image.type || 'image/jpeg', upsert: true });
      if (uploadError) {
        console.error('News recurring rule image upload error:', uploadError);
        return NextResponse.json({ error: '画像のアップロードに失敗しました' }, { status: 500 });
      }
      const { data: urlData } = supabase.storage.from('therapist-photos').getPublicUrl(storagePath);
      imageUrl = urlData.publicUrl;
    }

    const { data, error } = await supabase
      .from('news_recurring_rules')
      .insert({
        shop_id: shopId,
        news_type: newsType,
        title,
        content,
        image_url: imageUrl,
        days_of_week: daysOfWeek,
        time_of_day: timeOfDay,
        start_date: startDate,
        end_date: endDate || null,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) {
      console.error('News recurring rule insert error:', error);
      return NextResponse.json({ error: '定期投稿ルールの保存に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ rule: data });
  } catch (error: any) {
    console.error('News recurring rule create error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
