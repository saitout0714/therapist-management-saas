-- Phase 2: Schema extensions & RLS policies for HP multi-tenant integration
-- (Shops, Therapists, Photos, Blog Articles / Diaries, News Items, Campaigns)

-- 1. Shops table HP fields extension
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS catchphrase TEXT;
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS theme_color JSONB DEFAULT '{"primary":"#d1b464","accent":"#a39573","darkBg":"#464646","lightBg":"#faf7f0"}'::jsonb;
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS access_info TEXT;
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS business_hours TEXT;
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS notice_banner TEXT;
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS x_url TEXT;
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS litlink_url TEXT;
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS line_url TEXT;

-- 2. Therapists table HP fields extension
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS name_kana TEXT;
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS badge TEXT;
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS litlink_url TEXT;
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS three_size TEXT;

-- 3. Therapist Photos gallery table
CREATE TABLE IF NOT EXISTS public.therapist_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Blog Articles (Diaries) table
CREATE TABLE IF NOT EXISTS public.blog_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES public.therapists(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    eye_catch_url TEXT,
    tags TEXT[] DEFAULT '{}',
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. News Items table
CREATE TABLE IF NOT EXISTS public.news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'お知らせ',
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Campaigns / Banners table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT,
    link_url TEXT,
    badge_text TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_therapist_photos_therapist ON public.therapist_photos(therapist_id);
CREATE INDEX IF NOT EXISTS idx_blog_articles_shop ON public.blog_articles(shop_id);
CREATE INDEX IF NOT EXISTS idx_blog_articles_therapist ON public.blog_articles(therapist_id);
CREATE INDEX IF NOT EXISTS idx_blog_articles_published ON public.blog_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_shop ON public.news_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_news_items_published ON public.news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_shop ON public.campaigns(shop_id);

-- 8. Row Level Security (RLS) policies

-- Enable RLS on all Phase 2 tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Public READ (SELECT) Policies for HP visitors
DO $$ 
BEGIN
    -- Shops: Anyone can view shops
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view shops') THEN
        CREATE POLICY "Public can view shops" ON public.shops FOR SELECT USING (true);
    END IF;

    -- Therapists: Anyone can view active therapists
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view active therapists') THEN
        CREATE POLICY "Public can view active therapists" ON public.therapists FOR SELECT USING (is_active = true);
    END IF;

    -- Therapist Photos: Anyone can view photos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view therapist photos') THEN
        CREATE POLICY "Public can view therapist photos" ON public.therapist_photos FOR SELECT USING (true);
    END IF;

    -- Blog Articles: Anyone can view blog articles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view blog articles') THEN
        CREATE POLICY "Public can view blog articles" ON public.blog_articles FOR SELECT USING (true);
    END IF;

    -- News Items: Anyone can view news items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view news items') THEN
        CREATE POLICY "Public can view news items" ON public.news_items FOR SELECT USING (true);
    END IF;

    -- Campaigns: Anyone can view active campaigns
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view active campaigns') THEN
        CREATE POLICY "Public can view active campaigns" ON public.campaigns FOR SELECT USING (is_active = true);
    END IF;
END $$;
