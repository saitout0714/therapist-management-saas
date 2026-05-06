-- セラピスト引き継ぎメモテーブル
CREATE TABLE IF NOT EXISTS public.therapist_memos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0, -- 正=余剰, 負=不足 (円)
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_id UUID
);

CREATE INDEX IF NOT EXISTS idx_therapist_memos_therapist_id ON public.therapist_memos(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_memos_shop_id ON public.therapist_memos(shop_id);
CREATE INDEX IF NOT EXISTS idx_therapist_memos_is_resolved ON public.therapist_memos(is_resolved);

ALTER TABLE public.therapist_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop members can manage therapist memos"
  ON public.therapist_memos FOR ALL
  USING (true) WITH CHECK (true);
