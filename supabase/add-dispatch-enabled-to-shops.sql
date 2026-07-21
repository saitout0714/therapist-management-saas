ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_dispatch_enabled boolean DEFAULT false;
