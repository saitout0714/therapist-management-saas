const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(projectUrl, serviceRoleKey);

async function main() {
  console.log('Applying customer-ng migration with parameter sql_query...');

  const sql = `
    -- 顧客ステータス・NG理由フィールド追加
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '予約可';
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ng_reason TEXT;

    -- 顧客×セラピスト NGペアテーブル
    CREATE TABLE IF NOT EXISTS public.customer_therapist_ng (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      shop_id UUID NOT NULL,
      customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
      therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
      reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(customer_id, therapist_id)
    );

    -- RLSの有効化
    ALTER TABLE public.customer_therapist_ng ENABLE ROW LEVEL SECURITY;
  `;

  // まずテーブルとカラムの作成を試みる
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Migration failed:', error);
  } else {
    console.log('Migration completed successfully!', data);
  }

  // ポリシーを作成
  console.log('Creating policy...');
  const policySql = `
    DROP POLICY IF EXISTS "Users can access customer_therapist_ng for their stores" ON public.customer_therapist_ng;
    CREATE POLICY "Users can access customer_therapist_ng for their stores" ON public.customer_therapist_ng 
      FOR ALL USING (true);
  `;
  const { data: pData, error: pError } = await supabase.rpc('exec_sql', { sql_query: policySql });
  if (pError) {
    console.error('Policy creation failed:', pError);
  } else {
    console.log('Policy created successfully!', pData);
  }
}

main().catch(console.error);
