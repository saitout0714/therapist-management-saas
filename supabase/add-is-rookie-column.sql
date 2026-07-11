-- therapists テーブルに is_rookie カラムを追加する
ALTER TABLE therapists ADD COLUMN is_rookie BOOLEAN DEFAULT FALSE NOT NULL;
