-- ========================================================
-- 複数店舗での同時間シフト重複登録許可マイグレーション
-- ========================================================

-- 1. 既存の店舗なしユニーク制約を削除
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_therapist_id_date_start_time_end_time_key;

-- 2. 店舗(shop_id)を含めたユニーク制約を新たに作成（既に存在していればスキップ）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shifts_therapist_id_shop_id_date_start_time_end_time_key'
    ) THEN
        ALTER TABLE public.shifts 
        ADD CONSTRAINT shifts_therapist_id_shop_id_date_start_time_end_time_key 
        UNIQUE (therapist_id, shop_id, date, start_time, end_time);
    END IF;
END $$;
