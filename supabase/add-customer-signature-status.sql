ALTER TABLE "public"."customers" 
  ADD COLUMN IF NOT EXISTS "signature_status" text NOT NULL DEFAULT '未署名'::text,
  ADD COLUMN IF NOT EXISTS "signed_at" timestamp with time zone;
