CREATE TABLE IF NOT EXISTS "public"."custom_templates" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "custom_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "custom_templates_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE
);

-- RLS
ALTER TABLE "public"."custom_templates" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Custom Templates Shop Owner Policy" ON "public"."custom_templates";
CREATE POLICY "Custom Templates Shop Owner Policy" ON "public"."custom_templates" 
  FOR ALL TO public USING (check_shop_access(shop_id));
