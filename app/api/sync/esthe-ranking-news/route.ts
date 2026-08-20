import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { postNewsToEstheRanking, EstheRankingNewsType } from '@/lib/sync/esthe-ranking-news';
import { createSyncJob, completeSyncJob } from '@/lib/sync/sync-job';
import { getEstheRankingCredentials, PORTAL_CREDENTIAL_COLUMNS } from '@/lib/sync/portal-credentials';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const VALID_NEWS_TYPES: EstheRankingNewsType[] = ['1', '2', '3', '4', '9'];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const shopId = formData.get('shopId') as string | null;
    const newsType = formData.get('newsType') as string | null;
    const title = (formData.get('title') as string | null)?.trim();
    const content = (formData.get('content') as string | null)?.trim();
    const publishNow = formData.get('publishNow') === 'true';
    const publishDate = formData.get('publishDate') as string | null;
    const publishHour = formData.get('publishHour') as string | null;
    const publishMinute = formData.get('publishMinute') as string | null;
    const endEnabled = formData.get('endEnabled') === 'true';
    const endPublishDate = formData.get('endPublishDate') as string | null;
    const endPublishHour = formData.get('endPublishHour') as string | null;
    const endPublishMinute = formData.get('endPublishMinute') as string | null;
    const image = formData.get('image') as File | null;

    if (!shopId || !newsType || !title || !content) {
      return NextResponse.json({ error: 'shopId, newsType, title, content は必須です' }, { status: 400 });
    }
    if (!VALID_NEWS_TYPES.includes(newsType as EstheRankingNewsType)) {
      return NextResponse.json({ error: '不正なニュース種別です' }, { status: 400 });
    }
    if (!publishNow && (!publishDate || !publishHour)) {
      return NextResponse.json({ error: '開始時刻を指定する場合は日付と時間が必要です' }, { status: 400 });
    }
    if (endEnabled && (!endPublishDate || !endPublishHour)) {
      return NextResponse.json({ error: '終了時刻を指定する場合は日付と時間が必要です' }, { status: 400 });
    }

    // 画像は一時ファイルとして保存しておき、バックグラウンド処理側でPlaywrightに渡す
    let imagePath: string | null = null;
    if (image && image.size > 0) {
      if (image.size > 1024 * 1024) {
        return NextResponse.json({ error: '画像はおよそ1MB未満のjpg,pngファイルのみ保存できます' }, { status: 400 });
      }
      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = image.name.match(/\.(jpg|jpeg|png)$/i)?.[0] || '.jpg';
      imagePath = path.join(os.tmpdir(), `er_news_img_${Date.now()}${ext}`);
      fs.writeFileSync(imagePath, buffer);
    }

    const jobId = await createSyncJob(shopId, 'news_post');
    if (!jobId) {
      return NextResponse.json({ error: 'Failed to create sync job' }, { status: 500 });
    }

    after(async () => {
      try {
        const { data: shop, error: shopError } = await supabase
          .from('shops')
          .select(PORTAL_CREDENTIAL_COLUMNS)
          .eq('id', shopId)
          .single();

        if (shopError || !shop) {
          await completeSyncJob(jobId, 'failed', { target: 'esthe_ranking', error: '店舗情報の取得に失敗しました' });
          return;
        }

        const erCreds = getEstheRankingCredentials(shop);
        if (!erCreds) {
          await completeSyncJob(jobId, 'failed', { target: 'esthe_ranking', error: '店舗設定画面でメンズエステランキングのログイン情報（URL, ID, パスワード）を設定してください' });
          return;
        }

        const result = await postNewsToEstheRanking(erCreds.loginUrl, erCreds.loginId, erCreds.password, {
          newsType: newsType as EstheRankingNewsType,
          publishNow,
          publishDate: publishDate || undefined,
          publishHour: publishHour || undefined,
          publishMinute: publishMinute || undefined,
          endEnabled,
          endPublishDate: endPublishDate || undefined,
          endPublishHour: endPublishHour || undefined,
          endPublishMinute: endPublishMinute || undefined,
          title,
          content,
          imagePath,
        });

        if (!result.success) {
          await completeSyncJob(jobId, 'failed', { target: 'esthe_ranking', error: result.error, title });
          return;
        }

        await completeSyncJob(jobId, 'completed', { target: 'esthe_ranking', message: result.message, title });
      } catch (error: any) {
        console.error('Esthe Ranking News Post API Error (Background):', error);
        await completeSyncJob(jobId, 'failed', { target: 'esthe_ranking', error: error.message || 'サーバーエラーが発生しました' });
      } finally {
        if (imagePath) {
          fs.unlink(imagePath, () => {});
        }
      }
    });

    return NextResponse.json({ message: 'バックグラウンドでニュース投稿を開始しました', jobId });
  } catch (error: any) {
    console.error('Esthe Ranking News Post API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
