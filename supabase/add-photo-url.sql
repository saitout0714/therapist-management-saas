-- セラピストプロフィール写真URL
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS photo_url TEXT;
