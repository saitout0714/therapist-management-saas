import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { postNewsToEstheRanking } from '@/lib/sync/esthe-ranking-news';
import { downloadImageToTemp } from '@/lib/sync/download-image';
import { createSyncJob, completeSyncJob } from '@/lib/sync/sync-job';
import { getEstheRankingCredentials, PORTAL_CREDENTIAL_COLUMNS } from '@/lib/sync/portal-credentials';
import { generateDueDraftsFromRecurringRules } from '@/lib/sync/news-recurring';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// 1回のcron実行で処理する最大件数（タイムアウト対策）
const MAX_PER_RUN = 10;

export async function GET() {
  try {
    // 1. 定期投稿ルールから、本日分でまだ生成されていない記事を news_drafts に登録する
    const recurringResult = await generateDueDraftsFromRecurringRules();
    if (recurringResult.errors.length > 0) {
      console.error('Recurring rule generation errors:', recurringResult.errors);
    }

    // 2. 予約時刻を過ぎた記事を送信する
    const now = new Date().toISOString();

    const { data: dueDrafts, error: fetchError } = await supabase
      .from('news_drafts')
      .select('*')
      .eq('status', 'pending')
      .eq('target_site', 'esthe_ranking')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(MAX_PER_RUN);

    if (fetchError) throw fetchError;
    if (!dueDrafts || dueDrafts.length === 0) {
      return NextResponse.json({ success: true, message: 'No due drafts.', recurringGenerated: recurringResult.generated });
    }

    const results = [];

    for (const draft of dueDrafts) {
      let imagePath: string | null = null;
      const jobId = await createSyncJob(draft.shop_id, 'news_post');

      try {
        const { data: shop, error: shopError } = await supabase
          .from('shops')
          .select(PORTAL_CREDENTIAL_COLUMNS)
          .eq('id', draft.shop_id)
          .single();

        if (shopError || !shop) {
          throw new Error('店舗情報の取得に失敗しました');
        }

        const erCreds = getEstheRankingCredentials(shop);
        if (!erCreds) {
          throw new Error('メンズエステランキングのログイン情報が未設定です');
        }

        if (draft.image_url) {
          imagePath = await downloadImageToTemp(draft.image_url, 'news_draft_img_');
        }

        const result = await postNewsToEstheRanking(erCreds.loginUrl, erCreds.loginId, erCreds.password, {
          newsType: draft.news_type,
          publishNow: true,
          title: draft.title,
          content: draft.content,
          imagePath,
        });

        if (!result.success) {
          throw new Error(result.error || '投稿に失敗しました');
        }

        await supabase
          .from('news_drafts')
          .update({ status: 'posted', posted_at: new Date().toISOString(), error_message: null })
          .eq('id', draft.id);

        if (jobId) await completeSyncJob(jobId, 'completed', { target: 'esthe_ranking', message: result.message, title: draft.title });

        results.push({ draftId: draft.id, success: true });
      } catch (e: any) {
        console.error(`News draft ${draft.id} post error:`, e);

        await supabase
          .from('news_drafts')
          .update({ status: 'failed', error_message: e.message })
          .eq('id', draft.id);

        if (jobId) await completeSyncJob(jobId, 'failed', { target: 'esthe_ranking', error: e.message, title: draft.title });

        results.push({ draftId: draft.id, success: false, error: e.message });
      } finally {
        if (imagePath) fs.unlink(imagePath, () => {});
      }
    }

    return NextResponse.json({ success: true, results, recurringGenerated: recurringResult.generated });
  } catch (err: any) {
    console.error('Cron News Drafts Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
