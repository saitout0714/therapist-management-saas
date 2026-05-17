-- セラピスト複数写真テーブル
CREATE TABLE IF NOT EXISTS therapist_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapist_photos_therapist_id ON therapist_photos(therapist_id);

-- RLS（既存テーブルに合わせて全許可）
ALTER TABLE therapist_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on therapist_photos" ON therapist_photos FOR ALL USING (true) WITH CHECK (true);

-- 既存の photo_url データを移行
INSERT INTO therapist_photos (therapist_id, photo_url, display_order)
SELECT id, photo_url, 0
FROM therapists
WHERE photo_url IS NOT NULL;
