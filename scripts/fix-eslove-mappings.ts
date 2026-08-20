/**
 * エステラブ連携IDの誤った紐付けを修正する。
 *  1. 「日祝割引2000円」「昼割2000円」は実在のキャストではないが、新規登録の
 *     ID取得ロジックの不具合により、無関係な既存キャスト「かんだ」(331304) の
 *     プロフィールに紐付いてしまっていた。そのまま同期すると「かんだ」の
 *     プロフィールを上書きしてしまうため、紐付けを解除する。
 *  2. 「かしわぎ」はポータル側に重複プロフィール(282985 / 274109)があり、
 *     古い方(274109)に紐付いていた。出勤情報ページに行があるのは282985の方
 *     なので、そちらに付け替える。
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const apply = process.argv.includes('--apply');

  const { data: bogus } = await supabase
    .from('therapists')
    .select('id, name, eslove_therapist_id')
    .eq('eslove_therapist_id', '331304');

  console.log('--- 331304(かんだ) に誤って紐付いているキャスト ---');
  for (const t of bogus || []) console.log(' ', t.name);

  const { data: kashiwagi } = await supabase
    .from('therapists')
    .select('id, name, eslove_therapist_id')
    .eq('eslove_therapist_id', '274109');

  console.log('--- 274109(かしわぎ・重複プロフィール) に紐付いているキャスト ---');
  for (const t of kashiwagi || []) console.log(' ', t.name);

  if (!apply) {
    console.log('\n※ 確認モードです。実際に修正するには --apply を付けて実行してください。');
    return;
  }

  for (const t of bogus || []) {
    const { error } = await supabase
      .from('therapists')
      .update({ eslove_therapist_id: null })
      .eq('id', t.id);
    console.log(error ? `NG ${t.name}: ${error.message}` : `OK ${t.name}: 紐付けを解除しました`);
  }

  for (const t of kashiwagi || []) {
    const { error } = await supabase
      .from('therapists')
      .update({ eslove_therapist_id: '282985' })
      .eq('id', t.id);
    console.log(error ? `NG ${t.name}: ${error.message}` : `OK ${t.name}: 282985 に付け替えました`);
  }
}

main();
