-- ============================================================================
-- おニャンこスパ(slug: onyankospa) SEO情報の更新
--
-- 作成日 : 2026-08-18
-- 適用先 : PRODUCTION DATABASE
-- 内容   : meta description と X(Twitter)公式アカウントURLの設定
-- ============================================================================

UPDATE public.shops
SET
    description = '東京・豊島区南大塚のメンズエステ「おニャンこスパ」。大塚駅徒歩5分、完全プライベート個室で厳選オイルによる本格密着マッサージ。出勤確認からご予約まで24時間WEB完結、初回2,000円OFF。',
    x_url = 'https://x.com/onyankospa_2'
WHERE slug = 'onyankospa';
