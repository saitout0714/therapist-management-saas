-- Web予約機能追加マイグレーション

-- 顧客テーブルにフリガナ追加
ALTER TABLE customers ADD COLUMN IF NOT EXISTS furigana TEXT;

-- 予約テーブルに支払い方法とソース追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('cash', 'credit')) DEFAULT 'cash';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('web', 'staff')) DEFAULT 'staff';

-- 店舗Web予約コードテーブル（公開URLスラッグ）
CREATE TABLE IF NOT EXISTS shop_reservation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE UNIQUE,
  code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_reservation_codes_code ON shop_reservation_codes(code);
CREATE INDEX IF NOT EXISTS idx_shop_reservation_codes_shop_id ON shop_reservation_codes(shop_id);

-- Supabase Storage: therapist-photosバケット作成
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'therapist-photos',
  'therapist-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- ストレージポリシー（既存のRLSに合わせてpublicアクセス許可）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read therapist photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public read therapist photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'therapist-photos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone upload therapist photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone upload therapist photos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'therapist-photos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone update therapist photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone update therapist photos" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'therapist-photos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone delete therapist photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone delete therapist photos" ON storage.objects FOR DELETE TO public USING (bucket_id = 'therapist-photos');
  END IF;
END $$;
