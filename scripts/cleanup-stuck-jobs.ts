import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 10分以上「処理中」のままのジョブを失敗扱いにする
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('sync_jobs')
    .update({ status: 'failed', result_details: { error: '処理が中断されたため失敗扱いにしました。' } })
    .eq('status', 'processing')
    .lt('created_at', cutoff)
    .select('id, target_type, created_at');

  if (error) { console.error(error); return; }
  console.log(`${data?.length || 0}件の滞留ジョブを失敗扱いにしました。`);
  for (const j of data || []) console.log('-', j.id, j.target_type, j.created_at);
}

main();
