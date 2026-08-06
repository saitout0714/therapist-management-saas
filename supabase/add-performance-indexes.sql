-- 一覧画面の表示速度を改善するための複合インデックス。
--
-- 既存のインデックスは単一カラムのみだったため、「shop_id で絞り込んで
-- created_at で並べ替えて100件取る」といった実際のクエリ形状では
-- 絞り込み後に毎回ソートが発生していた。並べ替えキーまで含めた複合
-- インデックスにすることで、ソートを省いて先頭N件を直接読めるようにする。
--
-- すべて IF NOT EXISTS なので、再実行しても既存環境に影響しない。

-- 予約一覧: .eq('shop_id').neq('status','blocked').order('created_at', desc).range()
CREATE INDEX IF NOT EXISTS idx_reservations_shop_id_created_at
  ON public.reservations USING btree (shop_id, created_at DESC);

-- 顧客の来店回数集計: .in('customer_id', ...).in('shop_id', ...)
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id_shop_id
  ON public.reservations USING btree (customer_id, shop_id);

-- 顧客一覧: .in('shop_id', ...).order('created_at', desc).range()
CREATE INDEX IF NOT EXISTS idx_customers_shop_id_created_at
  ON public.customers USING btree (shop_id, created_at DESC);

-- 顧客検索: .in('shop_id', ...).order('name').range()
CREATE INDEX IF NOT EXISTS idx_customers_shop_id_name
  ON public.customers USING btree (shop_id, name);

-- NG顧客判定: .in('customer_id', ...)
-- current-schema.sql 上は主キーしか存在せず、customer_id を先頭に持つ
-- インデックスが無いため、一覧を開くたびに全件走査になっていた。
CREATE INDEX IF NOT EXISTS idx_customer_therapist_ng_customer_id
  ON public.customer_therapist_ng USING btree (customer_id);

-- 未解決メモ: .eq('shop_id').eq('is_resolved', false).order('date', desc)
-- 未解決のものだけを対象にした部分インデックス（解決済みが増えても太らない）
CREATE INDEX IF NOT EXISTS idx_therapist_memos_unresolved
  ON public.therapist_memos USING btree (shop_id, date DESC)
  WHERE is_resolved = false;

-- セラピスト写真: .in('therapist_id', ...).order('display_order')
CREATE INDEX IF NOT EXISTS idx_therapist_photos_therapist_id_display_order
  ON public.therapist_photos USING btree (therapist_id, display_order);

-- シフト画面: .eq('shop_id').eq('date')
-- add-reserve-indexes.sql と同じ定義。本番に未適用の可能性があるため再掲する。
CREATE INDEX IF NOT EXISTS idx_shifts_shop_id_date
  ON public.shifts USING btree (shop_id, date);

CREATE INDEX IF NOT EXISTS idx_reservations_shop_id_date
  ON public.reservations USING btree (shop_id, date);

-- 統計情報を更新して、プランナに新しいインデックスを使わせる
ANALYZE public.reservations;
ANALYZE public.customers;
ANALYZE public.customer_therapist_ng;
ANALYZE public.therapist_memos;
ANALYZE public.therapist_photos;
ANALYZE public.shifts;
