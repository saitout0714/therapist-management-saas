-- ============================================================================
-- 店舗ごとに「利用できる決済方法」を設定できるようにする
--
-- 作成日 : 2026-08-05
-- 適用先 : PRODUCTION
-- 性質   : 列の追加と初期値の投入のみ。既存の設定値・予約データは変更しない。
--
-- 背景:
--   予約登録画面の支払方法は常に「現金／クレジット／PayPay」が並んでおり、
--   クレジットを扱わない店舗でも選べてしまう。実際、決済リンクが未設定の
--   4店舗（レジェンド・タイガーリリー・レジェンド目白・アロマエレガンス）で
--   クレジット払いの予約が計11件入っており、お客様に決済ページを案内できない
--   まま手数料だけが加算されていた。
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 利用可否の列を追加
--    NOT NULL / DEFAULT は付けない。
--    system_settings の行が無い店舗（SpecialGrade 等）では NULL のままとなり、
--    コード側の「値が無ければ従来どおり全て選べる」フォールバックが働く。
-- ----------------------------------------------------------------------------
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS enable_cash_payment   BOOLEAN;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS enable_credit_payment BOOLEAN;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS enable_paypay_payment BOOLEAN;

-- ----------------------------------------------------------------------------
-- 2. 初期値の投入
--    現状の運用実態から推定する。誤ってできていた機能を取り上げないよう、
--    「実績があるものは有効のまま」を原則とする（不要なら画面から外せる）。
-- ----------------------------------------------------------------------------

-- 現金：全店舗で利用可
UPDATE public.system_settings
   SET enable_cash_payment = true
 WHERE enable_cash_payment IS NULL;

-- クレジット：決済リンクがある、またはクレジット払いの予約実績がある店舗のみ有効
UPDATE public.system_settings ss
   SET enable_credit_payment = (
         (ss.credit_payment_url IS NOT NULL AND ss.credit_payment_url <> '')
         OR EXISTS (
           SELECT 1 FROM public.reservations r
            WHERE r.shop_id = ss.shop_id AND r.payment_method = 'credit'
         )
       )
 WHERE ss.enable_credit_payment IS NULL;

-- PayPay：PayPay払いの予約実績がある店舗のみ有効
UPDATE public.system_settings ss
   SET enable_paypay_payment = EXISTS (
         SELECT 1 FROM public.reservations r
          WHERE r.shop_id = ss.shop_id AND r.payment_method = 'paypay'
       )
 WHERE ss.enable_paypay_payment IS NULL;

COMMIT;

-- ============================================================================
-- 適用後の確認用
--   SELECT s.name, ss.enable_cash_payment, ss.enable_credit_payment, ss.enable_paypay_payment
--     FROM public.shops s JOIN public.system_settings ss ON ss.shop_id = s.id
--    WHERE s.is_active = true ORDER BY s.name;
-- ============================================================================
