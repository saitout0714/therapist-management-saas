-- reservations テーブルに payment_settled_at カラム（クレジット/PayPay の入金確認日時）を追加します。
--
-- NULL      = 未決済（入金確認がまだ）
-- 日時あり  = 決済完了（その日時に確認済みとしてマークされた）
--
-- 現金のみの予約では使用しません。支払方法（本体・オプション・延長のいずれか）に
-- credit または paypay が含まれる予約だけがタイムチャート上で「未決済」として色分けされます。

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_settled_at TIMESTAMPTZ;

-- 既存データの扱い:
-- 過去の予約まで一斉に「未決済」で表示されると運用上ノイズになるため、
-- この機能を導入した時点より前の予約は決済完了済みとみなして日時を入れておきます。
-- （まっさらな状態から運用したい場合は、この UPDATE 文をコメントアウトしてください）
UPDATE reservations
SET payment_settled_at = COALESCE(updated_at, created_at, now())
WHERE payment_settled_at IS NULL
  AND date < CURRENT_DATE;

-- 未決済の予約を絞り込む用途のインデックス
CREATE INDEX IF NOT EXISTS idx_reservations_payment_settled_at
  ON public.reservations USING btree (payment_settled_at);

-- 確認用クエリ
-- SELECT id, date, start_time, payment_method, options_payment_method, extension_payment_method, payment_settled_at
-- FROM reservations
-- WHERE 'credit' IN (payment_method, options_payment_method, extension_payment_method)
--    OR 'paypay' IN (payment_method, options_payment_method, extension_payment_method)
-- ORDER BY date DESC, start_time DESC LIMIT 20;
