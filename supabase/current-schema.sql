-- === 1. EXTENSIONS ===
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";

-- === 2. ENUMS ===

-- === 3. FUNCTIONS ===
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, login_id, password_hash, role, name, created_at, updated_at)
  VALUES (
    new.id,
    -- メールのドメイン部分を除去して login_id とする（SaaSオーナー用）
    split_part(new.email, '@', 1),
    new.encrypted_password,
    COALESCE(new.raw_user_meta_data->>'role', 'owner'), -- メタデータから役割を同期
    COALESCE(new.raw_user_meta_data->>'name', ''),       -- メタデータから名前を同期
    new.created_at,
    new.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    login_id = EXCLUDED.login_id,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    name = EXCLUDED.name,
    updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_shop_access(target_shop_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- A. ログインしていない場合はアクセス拒否
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- B. システム管理者（system_admin） または 受付スタッフ（agency_staff） の場合は全アクセスを許可
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('system_admin', 'agency_staff')
  ) THEN
    RETURN TRUE;
  END IF;

  -- C. 店舗オーナーなどの場合は、自分が所有している店舗（shop_owners）のみ許可
  RETURN EXISTS (
    SELECT 1 FROM public.shop_owners
    WHERE shop_id = target_shop_id AND user_id = auth.uid()
  );
END;
$function$
;

-- === 4. TABLES ===
CREATE TABLE IF NOT EXISTS "public"."course_back_amounts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "rank_id" uuid,
  "designation_type" text NOT NULL DEFAULT 'free'::text,
  "back_amount" integer NOT NULL,
  "customer_price" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "course_price_override" integer,
  CONSTRAINT "course_back_amounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."courses" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "store_id" uuid,
  "name" text NOT NULL,
  "duration" integer NOT NULL,
  "base_price" integer NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true,
  "display_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "shop_id" uuid,
  "includes_nomination_fee" boolean DEFAULT false,
  "back_amount" integer NOT NULL DEFAULT 0,
  CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."customer_therapist_ng" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "shop_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "therapist_id" uuid NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "customer_therapist_ng_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."customers" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "store_id" uuid,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "shop_id" uuid,
  "phone2" text,
  "status" text NOT NULL DEFAULT '予約可'::text,
  "ng_reason" text,
  "furigana" text,
  "memo" text,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."deduction_rules" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL DEFAULT 'deduction'::text,
  "calc_timing" text NOT NULL DEFAULT 'per_reservation'::text,
  "amount" integer NOT NULL,
  "min_duration" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "deduction_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."designation_types" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "slug" text NOT NULL,
  "display_name" text NOT NULL,
  "display_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "is_store_paid_back" boolean DEFAULT false,
  "treats_as_confirmed" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "default_fee" integer DEFAULT 0,
  "default_back_amount" integer DEFAULT 0,
  CONSTRAINT "designation_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "designation_types_shop_id_slug_key" UNIQUE ("shop_id", "slug")
);

CREATE TABLE IF NOT EXISTS "public"."discount_policies" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "discount_type" text NOT NULL DEFAULT 'fixed'::text,
  "discount_value" integer NOT NULL,
  "burden_type" text NOT NULL DEFAULT 'shop_only'::text,
  "is_combinable" boolean DEFAULT false,
  "max_per_reservation" integer DEFAULT 1,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "therapist_burden_amount" integer NOT NULL DEFAULT 0,
  CONSTRAINT "discount_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."discount_rank_overrides" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "discount_policy_id" uuid NOT NULL,
  "rank_id" uuid NOT NULL,
  "therapist_burden_amount" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "discount_rank_overrides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."extension_rank_prices" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "rank_id" uuid NOT NULL,
  "extension_unit_price" integer NOT NULL DEFAULT 0,
  "extension_unit_back" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "extension_rank_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."nomination_fees" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "fee_type" text NOT NULL,
  "name" text NOT NULL,
  "price" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "nomination_fees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."option_back_rules" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "option_id" uuid NOT NULL,
  "calc_type" text NOT NULL DEFAULT 'percentage'::text,
  "back_rate" numeric,
  "back_amount" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "option_back_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."options" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "store_id" uuid,
  "name" text NOT NULL,
  "duration" integer DEFAULT 0,
  "price" integer NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true,
  "display_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "shop_id" uuid,
  "option_type" text NOT NULL DEFAULT 'extension'::text,
  "duration_minutes_added" integer DEFAULT 0,
  "back_amount" integer NOT NULL DEFAULT 0,
  "back_category" text NOT NULL DEFAULT 'その他'::text,
  CONSTRAINT "options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."payroll_entries" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "therapist_id" uuid NOT NULL,
  "business_date" date NOT NULL,
  "total_sales" integer DEFAULT 0,
  "total_back" integer DEFAULT 0,
  "total_deductions" integer DEFAULT 0,
  "total_allowances" integer DEFAULT 0,
  "net_pay" integer DEFAULT 0,
  "reservation_count" integer DEFAULT 0,
  "status" text DEFAULT 'draft'::text,
  "confirmed_by" uuid,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."rank_back_rules" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "rank_id" uuid NOT NULL,
  "course_back_rate" numeric,
  "option_back_rate" numeric,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "rank_back_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."reservation_change_log" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "reservation_id" uuid NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now(),
  "changed_by" uuid,
  "field_name" text NOT NULL,
  "old_value" text,
  "new_value" text,
  "reason" text,
  CONSTRAINT "reservation_change_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."reservation_discounts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "reservation_id" uuid NOT NULL,
  "policy_id" uuid,
  "applied_amount" integer NOT NULL,
  "burden_type" text NOT NULL,
  "is_adhoc" boolean DEFAULT false,
  "adhoc_name" text,
  "approved_by" uuid,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "therapist_burden_amount" integer,
  CONSTRAINT "reservation_discounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."reservation_options" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "reservation_id" uuid,
  "option_id" uuid,
  "quantity" integer DEFAULT 1,
  "price" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "added_at" timestamp with time zone DEFAULT now(),
  "is_mid_session" boolean DEFAULT false,
  "custom_name" text,
  "custom_back_amount" integer DEFAULT 0,
  CONSTRAINT "reservation_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."reservations" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "store_id" uuid,
  "therapist_id" uuid,
  "customer_id" uuid,
  "shift_id" uuid,
  "date" date NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "status" text DEFAULT 'pending'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "course_id" uuid,
  "room_id" uuid,
  "total_price" integer DEFAULT 0,
  "base_price" integer DEFAULT 0,
  "nomination_fee" integer DEFAULT 0,
  "options_price" integer DEFAULT 0,
  "notes" text,
  "designation_type" text DEFAULT 'free'::text,
  "discount_amount" integer DEFAULT 0,
  "discount_reason" text,
  "shop_id" uuid,
  "therapist_back_amount" integer DEFAULT 0,
  "shop_revenue" integer DEFAULT 0,
  "back_calculated_at" timestamp with time zone,
  "business_date" date,
  "original_therapist_id" uuid,
  "original_designation_type" text,
  "change_reason" text,
  "created_by_id" uuid,
  "reception_source" character varying(20) DEFAULT 'staff'::character varying,
  "payment_method" text DEFAULT 'cash'::text,
  "options_payment_method" text DEFAULT 'cash'::text,
  "extension_payment_method" text DEFAULT 'cash'::text,
  "credit_fee_amount" integer DEFAULT 0,
  "designation_type_id" uuid,
  "extension_count" integer NOT NULL DEFAULT 0,
  "is_hime" boolean DEFAULT false,
  "hime_type" text,
  "hime_bonus" integer DEFAULT 0,
  "source" text DEFAULT 'staff'::text,
  "is_handled" boolean DEFAULT true,
  CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."rooms" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "store_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "shop_id" uuid,
  "address" text,
  "google_map_url" text,
  "order" integer,
  "address_nearby" text,
  "google_map_url_nearby" text,
  "sms_note_common" text,
  "sms_note_new_customer" text,
  "sms_note_member" text,
  "display_name" text,
  "template_member" text,
  "template_new_customer" text,
  "template_web_member" text,
  "template_web_new_customer" text,
  "memo" text,
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."shifts" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "therapist_id" uuid,
  "store_id" uuid,
  "date" date NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "room_id" uuid,
  "shop_id" uuid,
  "notes" text,
  CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."shop_back_rules" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "course_calc_type" text NOT NULL DEFAULT 'percentage'::text,
  "course_back_rate" numeric DEFAULT 50.00,
  "option_calc_type" text NOT NULL DEFAULT 'full_back'::text,
  "option_back_rate" numeric DEFAULT 100.00,
  "nomination_calc_type" text NOT NULL DEFAULT 'full_back'::text,
  "nomination_back_rate" numeric DEFAULT 100.00,
  "rounding_method" text NOT NULL DEFAULT 'floor'::text,
  "business_day_cutoff" time without time zone NOT NULL DEFAULT '06:00:00'::time without time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "shop_back_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."shop_owners" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "shop_owners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."shop_reservation_codes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid,
  "code" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "shop_reservation_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."shops" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(255) NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "order" integer DEFAULT 0,
  "short_name" text,
  "sms_address_mode" text NOT NULL DEFAULT 'unified'::text,
  "special_rules" text,
  "phone" text,
  CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."stores" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "address" text,
  "phone" text,
  "owner_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."system_settings" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "default_nomination_fee" integer NOT NULL DEFAULT 0,
  "default_confirmed_nomination_fee" integer NOT NULL DEFAULT 0,
  "default_princess_reservation_fee" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "reservation_interval_minutes" integer NOT NULL DEFAULT 20,
  "nomination_back_amount" integer NOT NULL DEFAULT 0,
  "confirmed_nomination_back_amount" integer NOT NULL DEFAULT 0,
  "princess_back_amount" integer NOT NULL DEFAULT 0,
  "credit_card_fee_rate" integer DEFAULT 10,
  "extension_unit_minutes" integer NOT NULL DEFAULT 30,
  "extension_unit_price" integer NOT NULL DEFAULT 0,
  "extension_unit_back" integer NOT NULL DEFAULT 0,
  "hp_url" text,
  "therapist_list_url" text,
  "schedule_url" text,
  "smtp_host" text,
  "smtp_port" integer,
  "smtp_secure" boolean DEFAULT false,
  "smtp_user" text,
  "smtp_pass" text,
  "smtp_from" text,
  "credit_payment_url" text,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."system_settings_backup" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "default_nomination_fee" integer DEFAULT 0,
  "default_confirmed_nomination_fee" integer DEFAULT 0,
  "default_princess_reservation_fee" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "system_settings_backup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."therapist_back_overrides" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "therapist_id" uuid NOT NULL,
  "course_back_rate" numeric,
  "option_back_rate" numeric,
  "nomination_back_rate" numeric,
  "course_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "therapist_back_overrides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."therapist_fee_overrides" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "therapist_id" uuid NOT NULL,
  "fee_type_id" uuid NOT NULL,
  "override_price" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "therapist_fee_overrides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."therapist_memos" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "therapist_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "date" date NOT NULL DEFAULT CURRENT_DATE,
  "content" text NOT NULL,
  "amount" integer NOT NULL DEFAULT 0,
  "is_resolved" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by_id" uuid,
  "resolved_at" timestamp with time zone,
  "resolved_date" date,
  CONSTRAINT "therapist_memos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."therapist_option_backs" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "shop_id" uuid NOT NULL,
  "therapist_id" uuid NOT NULL,
  "option_category" text,
  "designation_type" text,
  "back_rate" numeric NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "therapist_option_backs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."therapist_photos" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "therapist_id" uuid NOT NULL,
  "photo_url" text NOT NULL,
  "display_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "therapist_photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."therapist_pricing" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "therapist_id" uuid,
  "nomination_fee" integer DEFAULT 0,
  "is_nomination_required" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "confirmed_nomination_fee" integer DEFAULT 0,
  "princess_reservation_fee" integer DEFAULT 0,
  CONSTRAINT "therapist_pricing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."therapist_ranks" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "display_order" integer DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "therapist_ranks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."therapists" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "store_id" uuid,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "age" integer,
  "height" integer,
  "bust" integer,
  "waist" integer,
  "hip" integer,
  "order" integer DEFAULT 0,
  "shop_id" uuid,
  "rank_id" uuid,
  "has_fee_override" boolean DEFAULT false,
  "back_calc_type" text,
  "reservation_interval_minutes" integer,
  "is_active" boolean NOT NULL DEFAULT true,
  "bust_cup" text,
  "comment" text,
  "hp_url" text,
  "photo_url" text,
  "ng_course_ids" uuid[] DEFAULT '{}',
  CONSTRAINT "therapists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."users" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "login_id" character varying(255) NOT NULL,
  "password_hash" character varying NOT NULL,
  "role" character varying(50) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "name" text,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- === 5. VIEWS ===
-- === 6. FOREIGN KEYS ===
ALTER TABLE "public"."therapists" 
  DROP CONSTRAINT IF EXISTS "therapists_shop_id_fkey",
  ADD CONSTRAINT "therapists_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."customers" 
  DROP CONSTRAINT IF EXISTS "customers_shop_id_fkey",
  ADD CONSTRAINT "customers_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservations" 
  DROP CONSTRAINT IF EXISTS "reservations_shop_id_fkey",
  ADD CONSTRAINT "reservations_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."shifts" 
  DROP CONSTRAINT IF EXISTS "shifts_shop_id_fkey",
  ADD CONSTRAINT "shifts_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."courses" 
  DROP CONSTRAINT IF EXISTS "courses_shop_id_fkey",
  ADD CONSTRAINT "courses_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."options" 
  DROP CONSTRAINT IF EXISTS "options_shop_id_fkey",
  ADD CONSTRAINT "options_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."therapist_ranks" 
  DROP CONSTRAINT IF EXISTS "therapist_ranks_shop_id_fkey",
  ADD CONSTRAINT "therapist_ranks_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."therapists" 
  DROP CONSTRAINT IF EXISTS "therapists_rank_id_fkey",
  ADD CONSTRAINT "therapists_rank_id_fkey" 
  FOREIGN KEY ("rank_id") 
  REFERENCES "public"."therapist_ranks" ("id")
  ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."nomination_fees" 
  DROP CONSTRAINT IF EXISTS "nomination_fees_shop_id_fkey",
  ADD CONSTRAINT "nomination_fees_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."therapist_fee_overrides" 
  DROP CONSTRAINT IF EXISTS "therapist_fee_overrides_therapist_id_fkey",
  ADD CONSTRAINT "therapist_fee_overrides_therapist_id_fkey" 
  FOREIGN KEY ("therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."therapist_fee_overrides" 
  DROP CONSTRAINT IF EXISTS "therapist_fee_overrides_fee_type_id_fkey",
  ADD CONSTRAINT "therapist_fee_overrides_fee_type_id_fkey" 
  FOREIGN KEY ("fee_type_id") 
  REFERENCES "public"."nomination_fees" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."rooms" 
  DROP CONSTRAINT IF EXISTS "rooms_shop_id_fkey",
  ADD CONSTRAINT "rooms_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."system_settings" 
  DROP CONSTRAINT IF EXISTS "system_settings_shop_id_fkey",
  ADD CONSTRAINT "system_settings_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."stores" 
  DROP CONSTRAINT IF EXISTS "stores_owner_id_fkey",
  ADD CONSTRAINT "stores_owner_id_fkey" 
  FOREIGN KEY ("owner_id") 
  REFERENCES "public"."users" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservations" 
  DROP CONSTRAINT IF EXISTS "reservations_customer_id_fkey",
  ADD CONSTRAINT "reservations_customer_id_fkey" 
  FOREIGN KEY ("customer_id") 
  REFERENCES "public"."customers" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservations" 
  DROP CONSTRAINT IF EXISTS "reservations_shift_id_fkey",
  ADD CONSTRAINT "reservations_shift_id_fkey" 
  FOREIGN KEY ("shift_id") 
  REFERENCES "public"."shifts" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."shifts" 
  DROP CONSTRAINT IF EXISTS "shifts_room_id_fkey",
  ADD CONSTRAINT "shifts_room_id_fkey" 
  FOREIGN KEY ("room_id") 
  REFERENCES "public"."rooms" ("id")
  ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."therapist_pricing" 
  DROP CONSTRAINT IF EXISTS "therapist_pricing_therapist_id_fkey",
  ADD CONSTRAINT "therapist_pricing_therapist_id_fkey" 
  FOREIGN KEY ("therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservations" 
  DROP CONSTRAINT IF EXISTS "reservations_course_id_fkey",
  ADD CONSTRAINT "reservations_course_id_fkey" 
  FOREIGN KEY ("course_id") 
  REFERENCES "public"."courses" ("id")
  ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."reservations" 
  DROP CONSTRAINT IF EXISTS "reservations_room_id_fkey",
  ADD CONSTRAINT "reservations_room_id_fkey" 
  FOREIGN KEY ("room_id") 
  REFERENCES "public"."rooms" ("id")
  ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."reservation_options" 
  DROP CONSTRAINT IF EXISTS "reservation_options_reservation_id_fkey",
  ADD CONSTRAINT "reservation_options_reservation_id_fkey" 
  FOREIGN KEY ("reservation_id") 
  REFERENCES "public"."reservations" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservation_options" 
  DROP CONSTRAINT IF EXISTS "reservation_options_option_id_fkey",
  ADD CONSTRAINT "reservation_options_option_id_fkey" 
  FOREIGN KEY ("option_id") 
  REFERENCES "public"."options" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."shop_owners" 
  DROP CONSTRAINT IF EXISTS "shop_owners_shop_id_fkey",
  ADD CONSTRAINT "shop_owners_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."shop_owners" 
  DROP CONSTRAINT IF EXISTS "shop_owners_user_id_fkey",
  ADD CONSTRAINT "shop_owners_user_id_fkey" 
  FOREIGN KEY ("user_id") 
  REFERENCES "public"."users" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."customer_therapist_ng" 
  DROP CONSTRAINT IF EXISTS "customer_therapist_ng_therapist_id_fkey",
  ADD CONSTRAINT "customer_therapist_ng_therapist_id_fkey" 
  FOREIGN KEY ("therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservations" 
  DROP CONSTRAINT IF EXISTS "reservations_original_therapist_id_fkey",
  ADD CONSTRAINT "reservations_original_therapist_id_fkey" 
  FOREIGN KEY ("original_therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."shop_back_rules" 
  DROP CONSTRAINT IF EXISTS "shop_back_rules_shop_id_fkey",
  ADD CONSTRAINT "shop_back_rules_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."shifts" 
  DROP CONSTRAINT IF EXISTS "shifts_therapist_id_fkey",
  ADD CONSTRAINT "shifts_therapist_id_fkey" 
  FOREIGN KEY ("therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."course_back_amounts" 
  DROP CONSTRAINT IF EXISTS "course_back_amounts_shop_id_fkey",
  ADD CONSTRAINT "course_back_amounts_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."course_back_amounts" 
  DROP CONSTRAINT IF EXISTS "course_back_amounts_course_id_fkey",
  ADD CONSTRAINT "course_back_amounts_course_id_fkey" 
  FOREIGN KEY ("course_id") 
  REFERENCES "public"."courses" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."course_back_amounts" 
  DROP CONSTRAINT IF EXISTS "course_back_amounts_rank_id_fkey",
  ADD CONSTRAINT "course_back_amounts_rank_id_fkey" 
  FOREIGN KEY ("rank_id") 
  REFERENCES "public"."therapist_ranks" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."rank_back_rules" 
  DROP CONSTRAINT IF EXISTS "rank_back_rules_shop_id_fkey",
  ADD CONSTRAINT "rank_back_rules_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."rank_back_rules" 
  DROP CONSTRAINT IF EXISTS "rank_back_rules_rank_id_fkey",
  ADD CONSTRAINT "rank_back_rules_rank_id_fkey" 
  FOREIGN KEY ("rank_id") 
  REFERENCES "public"."therapist_ranks" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."therapist_back_overrides" 
  DROP CONSTRAINT IF EXISTS "therapist_back_overrides_therapist_id_fkey",
  ADD CONSTRAINT "therapist_back_overrides_therapist_id_fkey" 
  FOREIGN KEY ("therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."therapist_back_overrides" 
  DROP CONSTRAINT IF EXISTS "therapist_back_overrides_course_id_fkey",
  ADD CONSTRAINT "therapist_back_overrides_course_id_fkey" 
  FOREIGN KEY ("course_id") 
  REFERENCES "public"."courses" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."option_back_rules" 
  DROP CONSTRAINT IF EXISTS "option_back_rules_shop_id_fkey",
  ADD CONSTRAINT "option_back_rules_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."option_back_rules" 
  DROP CONSTRAINT IF EXISTS "option_back_rules_option_id_fkey",
  ADD CONSTRAINT "option_back_rules_option_id_fkey" 
  FOREIGN KEY ("option_id") 
  REFERENCES "public"."options" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservations" 
  DROP CONSTRAINT IF EXISTS "reservations_therapist_id_fkey",
  ADD CONSTRAINT "reservations_therapist_id_fkey" 
  FOREIGN KEY ("therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."discount_policies" 
  DROP CONSTRAINT IF EXISTS "discount_policies_shop_id_fkey",
  ADD CONSTRAINT "discount_policies_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservation_discounts" 
  DROP CONSTRAINT IF EXISTS "reservation_discounts_reservation_id_fkey",
  ADD CONSTRAINT "reservation_discounts_reservation_id_fkey" 
  FOREIGN KEY ("reservation_id") 
  REFERENCES "public"."reservations" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservation_discounts" 
  DROP CONSTRAINT IF EXISTS "reservation_discounts_policy_id_fkey",
  ADD CONSTRAINT "reservation_discounts_policy_id_fkey" 
  FOREIGN KEY ("policy_id") 
  REFERENCES "public"."discount_policies" ("id")
  ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "public"."deduction_rules" 
  DROP CONSTRAINT IF EXISTS "deduction_rules_shop_id_fkey",
  ADD CONSTRAINT "deduction_rules_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."payroll_entries" 
  DROP CONSTRAINT IF EXISTS "payroll_entries_shop_id_fkey",
  ADD CONSTRAINT "payroll_entries_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."payroll_entries" 
  DROP CONSTRAINT IF EXISTS "payroll_entries_therapist_id_fkey",
  ADD CONSTRAINT "payroll_entries_therapist_id_fkey" 
  FOREIGN KEY ("therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservation_change_log" 
  DROP CONSTRAINT IF EXISTS "reservation_change_log_reservation_id_fkey",
  ADD CONSTRAINT "reservation_change_log_reservation_id_fkey" 
  FOREIGN KEY ("reservation_id") 
  REFERENCES "public"."reservations" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservations" 
  DROP CONSTRAINT IF EXISTS "reservations_created_by_id_fkey",
  ADD CONSTRAINT "reservations_created_by_id_fkey" 
  FOREIGN KEY ("created_by_id") 
  REFERENCES "public"."users" ("id")
  ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "public"."designation_types" 
  DROP CONSTRAINT IF EXISTS "designation_types_shop_id_fkey",
  ADD CONSTRAINT "designation_types_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."reservations" 
  DROP CONSTRAINT IF EXISTS "reservations_designation_type_id_fkey",
  ADD CONSTRAINT "reservations_designation_type_id_fkey" 
  FOREIGN KEY ("designation_type_id") 
  REFERENCES "public"."designation_types" ("id")
  ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE "public"."extension_rank_prices" 
  DROP CONSTRAINT IF EXISTS "extension_rank_prices_shop_id_fkey",
  ADD CONSTRAINT "extension_rank_prices_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."extension_rank_prices" 
  DROP CONSTRAINT IF EXISTS "extension_rank_prices_rank_id_fkey",
  ADD CONSTRAINT "extension_rank_prices_rank_id_fkey" 
  FOREIGN KEY ("rank_id") 
  REFERENCES "public"."therapist_ranks" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."therapist_option_backs" 
  DROP CONSTRAINT IF EXISTS "therapist_option_backs_therapist_id_fkey",
  ADD CONSTRAINT "therapist_option_backs_therapist_id_fkey" 
  FOREIGN KEY ("therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."discount_rank_overrides" 
  DROP CONSTRAINT IF EXISTS "discount_rank_overrides_shop_id_fkey",
  ADD CONSTRAINT "discount_rank_overrides_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."discount_rank_overrides" 
  DROP CONSTRAINT IF EXISTS "discount_rank_overrides_discount_policy_id_fkey",
  ADD CONSTRAINT "discount_rank_overrides_discount_policy_id_fkey" 
  FOREIGN KEY ("discount_policy_id") 
  REFERENCES "public"."discount_policies" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."discount_rank_overrides" 
  DROP CONSTRAINT IF EXISTS "discount_rank_overrides_rank_id_fkey",
  ADD CONSTRAINT "discount_rank_overrides_rank_id_fkey" 
  FOREIGN KEY ("rank_id") 
  REFERENCES "public"."therapist_ranks" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."therapist_memos" 
  DROP CONSTRAINT IF EXISTS "therapist_memos_therapist_id_fkey",
  ADD CONSTRAINT "therapist_memos_therapist_id_fkey" 
  FOREIGN KEY ("therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."therapist_memos" 
  DROP CONSTRAINT IF EXISTS "therapist_memos_shop_id_fkey",
  ADD CONSTRAINT "therapist_memos_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."shop_reservation_codes" 
  DROP CONSTRAINT IF EXISTS "shop_reservation_codes_shop_id_fkey",
  ADD CONSTRAINT "shop_reservation_codes_shop_id_fkey" 
  FOREIGN KEY ("shop_id") 
  REFERENCES "public"."shops" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."therapist_photos" 
  DROP CONSTRAINT IF EXISTS "therapist_photos_therapist_id_fkey",
  ADD CONSTRAINT "therapist_photos_therapist_id_fkey" 
  FOREIGN KEY ("therapist_id") 
  REFERENCES "public"."therapists" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE "public"."customer_therapist_ng" 
  DROP CONSTRAINT IF EXISTS "customer_therapist_ng_customer_id_fkey",
  ADD CONSTRAINT "customer_therapist_ng_customer_id_fkey" 
  FOREIGN KEY ("customer_id") 
  REFERENCES "public"."customers" ("id")
  ON UPDATE NO ACTION ON DELETE CASCADE;

-- === 7. INDEXES ===
CREATE INDEX IF NOT EXISTS idx_therapists_is_active ON public.therapists USING btree (shop_id, is_active);
CREATE INDEX IF NOT EXISTS idx_reservations_business_date ON public.reservations USING btree (business_date);
CREATE INDEX IF NOT EXISTS idx_shop_back_rules_shop_id ON public.shop_back_rules USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_active ON public.courses USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_therapist_memos_is_resolved ON public.therapist_memos USING btree (is_resolved);
CREATE INDEX IF NOT EXISTS idx_therapist_memos_therapist_id ON public.therapist_memos USING btree (therapist_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_id ON public.users USING btree (login_id);
CREATE INDEX IF NOT EXISTS idx_designation_types_shop_id ON public.designation_types USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_reservations_original_therapist_id ON public.reservations USING btree (original_therapist_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.shifts USING btree (date);
CREATE INDEX IF NOT EXISTS idx_therapist_option_backs_shop ON public.therapist_option_backs USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_reservation_codes_code ON public.shop_reservation_codes USING btree (code);
CREATE INDEX IF NOT EXISTS idx_system_settings_shop_id ON public.system_settings USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON public.customers USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_therapists_shop_id ON public.therapists USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_status ON public.payroll_entries USING btree (status);
CREATE INDEX IF NOT EXISTS idx_reservation_options_reservation_id ON public.reservation_options USING btree (reservation_id);
CREATE INDEX IF NOT EXISTS idx_shifts_therapist_id ON public.shifts USING btree (therapist_id);
CREATE INDEX IF NOT EXISTS idx_reservation_discounts_policy_id ON public.reservation_discounts USING btree (policy_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON public.reservations USING btree (date);
CREATE INDEX IF NOT EXISTS idx_reservation_change_log_reservation_id ON public.reservation_change_log USING btree (reservation_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_therapist_id ON public.payroll_entries USING btree (therapist_id);
CREATE INDEX IF NOT EXISTS idx_course_back_amounts_shop_id ON public.course_back_amounts USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_option_back_rules_shop_id ON public.option_back_rules USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_reservations_reception_source ON public.reservations USING btree (reception_source);
CREATE INDEX IF NOT EXISTS idx_reservations_shop_id ON public.reservations USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers USING btree (store_id);
CREATE INDEX IF NOT EXISTS idx_therapist_back_overrides_therapist_id ON public.therapist_back_overrides USING btree (therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_pricing_therapist_id ON public.therapist_pricing USING btree (therapist_id);
CREATE INDEX IF NOT EXISTS idx_rank_back_rules_rank_id ON public.rank_back_rules USING btree (rank_id);
CREATE INDEX IF NOT EXISTS idx_deduction_rules_shop_id ON public.deduction_rules USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_reservations_course_id ON public.reservations USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_reservations_designation_type_id ON public.reservations USING btree (designation_type_id);
CREATE INDEX IF NOT EXISTS idx_reservations_shift_id ON public.reservations USING btree (shift_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_shop_id ON public.payroll_entries USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_reservation_options_option_id ON public.reservation_options USING btree (option_id);
CREATE INDEX IF NOT EXISTS idx_shifts_store_id ON public.shifts USING btree (store_id);
CREATE INDEX IF NOT EXISTS idx_shifts_shop_id ON public.shifts USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_options_is_active ON public.options USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_reservations_designation_type ON public.reservations USING btree (designation_type);
CREATE INDEX IF NOT EXISTS idx_course_back_amounts_rank_id ON public.course_back_amounts USING btree (rank_id);
CREATE INDEX IF NOT EXISTS idx_shop_reservation_codes_shop_id ON public.shop_reservation_codes USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_options_shop_id ON public.options USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_courses_shop_id ON public.courses USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_course_back_amounts_course_id ON public.course_back_amounts USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_rooms_shop_id ON public.rooms USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_reservations_store_id ON public.reservations USING btree (store_id);
CREATE INDEX IF NOT EXISTS idx_rank_back_rules_shop_id ON public.rank_back_rules USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_options_store_id ON public.options USING btree (store_id);
CREATE INDEX IF NOT EXISTS idx_option_back_rules_option_id ON public.option_back_rules USING btree (option_id);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON public.reservations USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_therapist_memos_shop_id ON public.therapist_memos USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_therapists_store_id ON public.therapists USING btree (store_id);
CREATE INDEX IF NOT EXISTS idx_therapist_photos_therapist_id ON public.therapist_photos USING btree (therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_option_backs_therapist ON public.therapist_option_backs USING btree (therapist_id);
CREATE INDEX IF NOT EXISTS idx_discount_policies_shop_id ON public.discount_policies USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_business_date ON public.payroll_entries USING btree (business_date);
CREATE INDEX IF NOT EXISTS idx_shop_owners_shop_id ON public.shop_owners USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_reservation_discounts_reservation_id ON public.reservation_discounts USING btree (reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_id ON public.reservations USING btree (room_id);
CREATE INDEX IF NOT EXISTS idx_shifts_room_id ON public.shifts USING btree (room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_therapist_id ON public.reservations USING btree (therapist_id);
CREATE INDEX IF NOT EXISTS idx_shop_owners_user_id ON public.shop_owners USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_courses_store_id ON public.courses USING btree (store_id);

-- === 8. RLS STATUS & POLICIES ===
ALTER TABLE "public"."discount_rank_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."therapist_memos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reservation_change_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shop_reservation_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."therapist_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."customer_therapist_ng" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."therapist_pricing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reservation_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."nomination_fees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."therapist_fee_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."therapist_ranks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."designation_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."therapists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shop_back_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rank_back_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."option_back_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."deduction_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."discount_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reservation_discounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."therapist_back_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."course_back_amounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payroll_entries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access their own stores" ON "public"."stores";
CREATE POLICY "Users can access their own stores" ON "public"."stores" FOR ALL TO public USING ((auth.uid() = owner_id));
DROP POLICY IF EXISTS "Users can access courses" ON "public"."courses";
CREATE POLICY "Users can access courses" ON "public"."courses" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access options" ON "public"."options";
CREATE POLICY "Users can access options" ON "public"."options" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access therapist_pricing" ON "public"."therapist_pricing";
CREATE POLICY "Users can access therapist_pricing" ON "public"."therapist_pricing" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access reservation_options" ON "public"."reservation_options";
CREATE POLICY "Users can access reservation_options" ON "public"."reservation_options" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access nomination_fees" ON "public"."nomination_fees";
CREATE POLICY "Users can access nomination_fees" ON "public"."nomination_fees" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access therapist_ranks" ON "public"."therapist_ranks";
CREATE POLICY "Users can access therapist_ranks" ON "public"."therapist_ranks" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access therapist_fee_overrides" ON "public"."therapist_fee_overrides";
CREATE POLICY "Users can access therapist_fee_overrides" ON "public"."therapist_fee_overrides" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users on therapist_ranks" ON "public"."therapist_ranks";
CREATE POLICY "Enable all access for authenticated users on therapist_ranks" ON "public"."therapist_ranks" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users on nomination_fees" ON "public"."nomination_fees";
CREATE POLICY "Enable all access for authenticated users on nomination_fees" ON "public"."nomination_fees" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all access for authenticated users on therapist_fee_over" ON "public"."therapist_fee_overrides";
CREATE POLICY "Enable all access for authenticated users on therapist_fee_over" ON "public"."therapist_fee_overrides" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users can access shop_back_rules" ON "public"."shop_back_rules";
CREATE POLICY "Users can access shop_back_rules" ON "public"."shop_back_rules" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access course_back_amounts" ON "public"."course_back_amounts";
CREATE POLICY "Users can access course_back_amounts" ON "public"."course_back_amounts" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access rank_back_rules" ON "public"."rank_back_rules";
CREATE POLICY "Users can access rank_back_rules" ON "public"."rank_back_rules" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access therapist_back_overrides" ON "public"."therapist_back_overrides";
CREATE POLICY "Users can access therapist_back_overrides" ON "public"."therapist_back_overrides" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access option_back_rules" ON "public"."option_back_rules";
CREATE POLICY "Users can access option_back_rules" ON "public"."option_back_rules" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access discount_policies" ON "public"."discount_policies";
CREATE POLICY "Users can access discount_policies" ON "public"."discount_policies" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access reservation_discounts" ON "public"."reservation_discounts";
CREATE POLICY "Users can access reservation_discounts" ON "public"."reservation_discounts" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access deduction_rules" ON "public"."deduction_rules";
CREATE POLICY "Users can access deduction_rules" ON "public"."deduction_rules" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access payroll_entries" ON "public"."payroll_entries";
CREATE POLICY "Users can access payroll_entries" ON "public"."payroll_entries" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access reservation_change_log" ON "public"."reservation_change_log";
CREATE POLICY "Users can access reservation_change_log" ON "public"."reservation_change_log" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access designation_types" ON "public"."designation_types";
CREATE POLICY "Users can access designation_types" ON "public"."designation_types" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Users can access discount_rank_overrides" ON "public"."discount_rank_overrides";
CREATE POLICY "Users can access discount_rank_overrides" ON "public"."discount_rank_overrides" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "shop members can manage therapist memos" ON "public"."therapist_memos";
CREATE POLICY "shop members can manage therapist memos" ON "public"."therapist_memos" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all on shop_reservation_codes" ON "public"."shop_reservation_codes";
CREATE POLICY "Allow all on shop_reservation_codes" ON "public"."shop_reservation_codes" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Shops RLS Policy" ON "public"."shops";
CREATE POLICY "Shops RLS Policy" ON "public"."shops" FOR ALL TO public USING (check_shop_access(id));
DROP POLICY IF EXISTS "Public Select Shop Policy" ON "public"."shops";
CREATE POLICY "Public Select Shop Policy" ON "public"."shops" FOR SELECT TO anon USING ((is_active = true));
DROP POLICY IF EXISTS "Public Select Shop Reservation Codes Policy" ON "public"."shop_reservation_codes";
CREATE POLICY "Public Select Shop Reservation Codes Policy" ON "public"."shop_reservation_codes" FOR SELECT TO anon USING ((is_active = true));
DROP POLICY IF EXISTS "Rooms Shop Owner Policy" ON "public"."rooms";
CREATE POLICY "Rooms Shop Owner Policy" ON "public"."rooms" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "Rooms Public Select Policy" ON "public"."rooms";
CREATE POLICY "Rooms Public Select Policy" ON "public"."rooms" FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Therapists Shop Owner Policy" ON "public"."therapists";
CREATE POLICY "Therapists Shop Owner Policy" ON "public"."therapists" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "Therapists Public Select Policy" ON "public"."therapists";
CREATE POLICY "Therapists Public Select Policy" ON "public"."therapists" FOR SELECT TO anon USING ((is_active = true));
DROP POLICY IF EXISTS "Customers Shop Owner Policy" ON "public"."customers";
CREATE POLICY "Customers Shop Owner Policy" ON "public"."customers" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "Customers Public Insert Policy" ON "public"."customers";
CREATE POLICY "Customers Public Insert Policy" ON "public"."customers" FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Shifts Shop Owner Policy" ON "public"."shifts";
CREATE POLICY "Shifts Shop Owner Policy" ON "public"."shifts" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "Shifts Public Select Policy" ON "public"."shifts";
CREATE POLICY "Shifts Public Select Policy" ON "public"."shifts" FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Courses Shop Owner Policy" ON "public"."courses";
CREATE POLICY "Courses Shop Owner Policy" ON "public"."courses" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "Courses Public Select Policy" ON "public"."courses";
CREATE POLICY "Courses Public Select Policy" ON "public"."courses" FOR SELECT TO anon USING ((is_active = true));
DROP POLICY IF EXISTS "Options Shop Owner Policy" ON "public"."options";
CREATE POLICY "Options Shop Owner Policy" ON "public"."options" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "Options Public Select Policy" ON "public"."options";
CREATE POLICY "Options Public Select Policy" ON "public"."options" FOR SELECT TO anon USING ((is_active = true));
DROP POLICY IF EXISTS "Therapist Pricing Shop Owner Policy" ON "public"."therapist_pricing";
CREATE POLICY "Therapist Pricing Shop Owner Policy" ON "public"."therapist_pricing" FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM therapists
  WHERE ((therapists.id = therapist_pricing.therapist_id) AND check_shop_access(therapists.shop_id)))));
DROP POLICY IF EXISTS "Therapist Pricing Public Select Policy" ON "public"."therapist_pricing";
CREATE POLICY "Therapist Pricing Public Select Policy" ON "public"."therapist_pricing" FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "System Settings Shop Owner Policy" ON "public"."system_settings";
CREATE POLICY "System Settings Shop Owner Policy" ON "public"."system_settings" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "System Settings Public Select Policy" ON "public"."system_settings";
CREATE POLICY "System Settings Public Select Policy" ON "public"."system_settings" FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Designation Types Shop Owner Policy" ON "public"."designation_types";
CREATE POLICY "Designation Types Shop Owner Policy" ON "public"."designation_types" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "Designation Types Public Select Policy" ON "public"."designation_types";
CREATE POLICY "Designation Types Public Select Policy" ON "public"."designation_types" FOR SELECT TO anon USING ((is_active = true));
DROP POLICY IF EXISTS "Discount Policies Shop Owner Policy" ON "public"."discount_policies";
CREATE POLICY "Discount Policies Shop Owner Policy" ON "public"."discount_policies" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "Discount Policies Public Select Policy" ON "public"."discount_policies";
CREATE POLICY "Discount Policies Public Select Policy" ON "public"."discount_policies" FOR SELECT TO anon USING ((is_active = true));
DROP POLICY IF EXISTS "Therapist Memos Shop Owner Policy" ON "public"."therapist_memos";
CREATE POLICY "Therapist Memos Shop Owner Policy" ON "public"."therapist_memos" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "Therapist Photos Shop Owner Policy" ON "public"."therapist_photos";
CREATE POLICY "Therapist Photos Shop Owner Policy" ON "public"."therapist_photos" FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM therapists
  WHERE ((therapists.id = therapist_photos.therapist_id) AND check_shop_access(therapists.shop_id)))));
DROP POLICY IF EXISTS "Therapist Photos Public Select Policy" ON "public"."therapist_photos";
CREATE POLICY "Therapist Photos Public Select Policy" ON "public"."therapist_photos" FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Reservations Shop Owner Policy" ON "public"."reservations";
CREATE POLICY "Reservations Shop Owner Policy" ON "public"."reservations" FOR ALL TO public USING (check_shop_access(shop_id));
DROP POLICY IF EXISTS "Reservations Public Insert Policy" ON "public"."reservations";
CREATE POLICY "Reservations Public Insert Policy" ON "public"."reservations" FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Reservations Public Select Policy" ON "public"."reservations";
CREATE POLICY "Reservations Public Select Policy" ON "public"."reservations" FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Reservation Options Shop Owner Policy" ON "public"."reservation_options";
CREATE POLICY "Reservation Options Shop Owner Policy" ON "public"."reservation_options" FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM reservations
  WHERE ((reservations.id = reservation_options.reservation_id) AND check_shop_access(reservations.shop_id)))));
DROP POLICY IF EXISTS "Reservation Options Public Insert Policy" ON "public"."reservation_options";
CREATE POLICY "Reservation Options Public Insert Policy" ON "public"."reservation_options" FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Reservation Options Public Select Policy" ON "public"."reservation_options";
CREATE POLICY "Reservation Options Public Select Policy" ON "public"."reservation_options" FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Reservation Discounts Shop Owner Policy" ON "public"."reservation_discounts";
CREATE POLICY "Reservation Discounts Shop Owner Policy" ON "public"."reservation_discounts" FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM reservations
  WHERE ((reservations.id = reservation_discounts.reservation_id) AND check_shop_access(reservations.shop_id)))));
DROP POLICY IF EXISTS "Reservation Discounts Public Insert Policy" ON "public"."reservation_discounts";
CREATE POLICY "Reservation Discounts Public Insert Policy" ON "public"."reservation_discounts" FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Reservation Discounts Public Select Policy" ON "public"."reservation_discounts";
CREATE POLICY "Reservation Discounts Public Select Policy" ON "public"."reservation_discounts" FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Users can access customer_therapist_ng for their stores" ON "public"."customer_therapist_ng";
CREATE POLICY "Users can access customer_therapist_ng for their stores" ON "public"."customer_therapist_ng" FOR ALL TO public USING (true);

-- === 9. TRIGGERS ===
DROP TRIGGER IF EXISTS "on_auth_user_created" ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
