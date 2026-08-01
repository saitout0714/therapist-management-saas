-- courses テーブルに show_on_timechart カラムを追加する
-- タイムチャートの空き時間候補ラベルにこのコースを使うかどうかを店舗ごとに選択できるようにする
ALTER TABLE courses ADD COLUMN show_on_timechart BOOLEAN DEFAULT TRUE NOT NULL;
