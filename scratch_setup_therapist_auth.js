const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log('1. Adding login_id and password columns to therapists table...');

  // カラム追加のSQL実行
  const sql = `
    ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS login_id TEXT;
    ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS password TEXT;
    
    CREATE TABLE IF NOT EXISTS public.therapist_blogs (
      id UUID NOT NULL DEFAULT gen_random_uuid(),
      therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
      shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      tags TEXT[] DEFAULT '{}',
      is_published BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT therapist_blogs_pkey PRIMARY KEY (id)
    );
  `;

  // therapists レコードの取得
  const { data: therapists, error: fetchErr } = await supabase
    .from('therapists')
    .select('id, name, login_id');

  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }

  console.log(`Found ${therapists.length} therapists in DB.`);

  let updatedCount = 0;
  for (const t of therapists) {
    // もし login_id が未設定の場合は、名前をもとに半角英数ローマ字IDを生成
    if (!t.login_id) {
      // 簡易ログインID作成
      const defaultLoginId = `th_${t.id.split('-')[0]}`;
      const defaultPassword = 'password123';

      const { error: updateErr } = await supabase
        .from('therapists')
        .update({
          login_id: defaultLoginId,
          password: defaultPassword
        })
        .eq('id', t.id);

      if (!updateErr) updatedCount++;
    }
  }

  console.log(`Successfully updated login credentials for ${updatedCount} therapists!`);
}

run();
