-- ============================================================================
-- news_items テーブルに is_published 列が無く、トピックス投稿が失敗する不具合の修正
--
-- 作成日 : 2026-08-18
-- 適用先 : PRODUCTION DATABASE
-- 原因   : phase2-schema-and-rls.sql が is_published 列なしで news_items を作成し、
--          後発の create-campaigns-and-news-tables.sql は
--          CREATE TABLE IF NOT EXISTS だったため、既存テーブルには反映されなかった。
-- 影響   : 全店舗で管理画面からの「トピックス」新規投稿が失敗する
--          （エラー: Could not find the 'is_published' column of 'news_items'）。
-- ============================================================================

ALTER TABLE public.news_items ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
