-- news_draftsテーブルの作成（メンズエステランキングへのニュース予約投稿）
CREATE TABLE IF NOT EXISTS public.news_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    target_site TEXT NOT NULL DEFAULT 'esthe_ranking',
    news_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending / posted / failed / cancelled
    error_message TEXT,
    posted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_drafts_pending ON public.news_drafts (status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_news_drafts_shop ON public.news_drafts (shop_id, created_at DESC);

-- RLS設定
ALTER TABLE public.news_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "News Drafts RLS Policy" ON "public"."news_drafts"
    FOR ALL
    TO public
    USING (check_shop_access(shop_id));

-- Cronジョブ（サービスロール）からは常にアクセス可能にするポリシー
CREATE POLICY "Service role can manage all news_drafts" ON public.news_drafts
    USING (true)
    WITH CHECK (true);
