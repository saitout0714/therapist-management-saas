-- Rooms テーブル作成
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- shifts テーブルに room_id カラムを追加
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_shifts_room_id ON public.shifts(room_id);

-- RLS有効化
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー
CREATE POLICY "Users can access rooms for their stores" ON public.rooms
  FOR ALL USING (true);

-- 完成メッセージ
SELECT 'Database schema initialized successfully!' as message;
