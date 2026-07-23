-- sync_jobsテーブルの作成
CREATE TABLE IF NOT EXISTS public.sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES public.therapists(id) ON DELETE SET NULL,
    target_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    result_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS設定
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sync Jobs RLS Policy" ON "public"."sync_jobs" 
    FOR ALL 
    TO public 
    USING (check_shop_access(shop_id));

-- サービスロールやCronジョブからは常にアクセス可能にするポリシー
CREATE POLICY "Service role can manage all sync_jobs" ON public.sync_jobs
    USING (true)
    WITH CHECK (true);
