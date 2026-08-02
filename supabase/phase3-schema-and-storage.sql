-- Phase 3: Schema extensions for Blog Articles (draft/published status), Shift Requests, and Storage Bucket

-- 1. Add is_published to blog_articles
ALTER TABLE IF EXISTS public.blog_articles ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;

-- 2. Add status and notes/request metadata to shifts
ALTER TABLE IF EXISTS public.shifts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
ALTER TABLE IF EXISTS public.shifts ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.shifts ADD COLUMN IF NOT EXISTS therapist_notes TEXT;

-- 3. Indexes for blog publication status and shift request status
CREATE INDEX IF NOT EXISTS idx_blog_articles_is_published ON public.blog_articles(is_published);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);

-- 4. Create blog-images Storage Bucket in Supabase if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Public Storage RLS Policies for blog-images
DO $$ 
BEGIN
    -- Public READ policy for blog-images
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Public Access for blog-images'
    ) THEN
        CREATE POLICY "Public Access for blog-images" ON storage.objects
        FOR SELECT USING (bucket_id = 'blog-images');
    END IF;

    -- Public / Auth INSERT policy for blog-images
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Upload Access for blog-images'
    ) THEN
        CREATE POLICY "Upload Access for blog-images" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'blog-images');
    END IF;
END $$;
