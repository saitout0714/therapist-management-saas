-- Add notification configuration columns to public.system_settings table
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS enable_email_notification boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_notification_email text,
ADD COLUMN IF NOT EXISTS enable_line_notification boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS line_channel_access_token text,
ADD COLUMN IF NOT EXISTS line_to_id text;

COMMENT ON COLUMN public.system_settings.enable_email_notification IS '管理者向けメール通知を有効にするか';
COMMENT ON COLUMN public.system_settings.admin_notification_email IS '管理者向けメール通知の送信先メールアドレス';
COMMENT ON COLUMN public.system_settings.enable_line_notification IS '管理者向けLINE通知を有効にするか';
COMMENT ON COLUMN public.system_settings.line_channel_access_token IS 'LINE Messaging APIのチャネルアクセストークン';
COMMENT ON COLUMN public.system_settings.line_to_id IS 'LINEの通知先ユーザーID/グループID';
