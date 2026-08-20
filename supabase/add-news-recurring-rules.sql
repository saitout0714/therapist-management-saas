-- news_recurring_rulesテーブルの作成（ニュースの定期自動投稿ルール）
CREATE TABLE IF NOT EXISTS public.news_recurring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    target_site TEXT NOT NULL DEFAULT 'esthe_ranking',
    news_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    days_of_week INT[] NOT NULL, -- 0=日,1=月,...,6=土 (JST基準)
    time_of_day TEXT NOT NULL,   -- 'HH:MM' (JST基準)
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active', -- active / paused
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_recurring_rules_active ON public.news_recurring_rules (status, shop_id);

ALTER TABLE public.news_recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "News Recurring Rules RLS Policy" ON "public"."news_recurring_rules"
    FOR ALL
    TO public
    USING (check_shop_access(shop_id));

CREATE POLICY "Service role can manage all news_recurring_rules" ON public.news_recurring_rules
    USING (true)
    WITH CHECK (true);

-- news_drafts側：どのルールから自動生成されたかを記録し、同じ日に二重生成しないようにする
ALTER TABLE public.news_drafts ADD COLUMN IF NOT EXISTS recurring_rule_id UUID REFERENCES public.news_recurring_rules(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_news_drafts_recurring_rule ON public.news_drafts (recurring_rule_id, scheduled_at);
