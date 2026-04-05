-- ============================================================
-- 時刻カラムのデータ型変更（TIME -> TEXT）
-- ============================================================
-- 理由: PostgreSQL の TIME 型は 24:00 までしか対応していませんが、
--       当システムでは深夜帯を「25:40」等で表現するため、TEXT 型へ変更します。

BEGIN;

-- 1. シフトテーブルの時刻カラムを変更
ALTER TABLE shifts ALTER COLUMN start_time TYPE TEXT;
ALTER TABLE shifts ALTER COLUMN end_time TYPE TEXT;

-- 2. 予約テーブルの時刻カラムを変更
ALTER TABLE reservations ALTER COLUMN start_time TYPE TEXT;
ALTER TABLE reservations ALTER COLUMN end_time TYPE TEXT;

-- 3. (オプション) 
-- 今後作成されるショップの基本バック計算ルールのカットオフ時刻も
-- 柔軟に対応できるように TEXT にしておくと良いかもしれませんが、
-- 現在のところ cutoff は 24:00 未満（例: 06:00）を想定しているため
-- TIME 型のままでも動作します。必要があれば適宜変更してください。

COMMIT;
