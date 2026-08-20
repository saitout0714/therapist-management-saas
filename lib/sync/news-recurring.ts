import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 定期投稿ルールをチェックし、本日分でまだ生成されていないものを
 * news_drafts に登録する。5分おきに呼ばれる想定なので、同じ日に
 * 二重生成しないよう recurring_rule_id + 当日(JST)の範囲で重複チェックする。
 */
export async function generateDueDraftsFromRecurringRules(): Promise<{ generated: number; errors: string[] }> {
  const errors: string[] = [];
  let generated = 0;

  // 現在時刻をJSTの壁時計として扱うためのDateオブジェクト（UTCゲッターでJSTの年月日を取り出す）
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const jstYear = jstNow.getUTCFullYear();
  const jstMonth = jstNow.getUTCMonth();
  const jstDate = jstNow.getUTCDate();
  const jstDow = jstNow.getUTCDay(); // 0=日 ... 6=土
  const todayStr = `${jstYear}-${pad2(jstMonth + 1)}-${pad2(jstDate)}`;

  const dayStartUtc = new Date(Date.UTC(jstYear, jstMonth, jstDate, 0, 0, 0) - 9 * 60 * 60 * 1000);
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  const { data: rules, error: rulesError } = await supabase
    .from('news_recurring_rules')
    .select('*')
    .eq('status', 'active')
    .lte('start_date', todayStr);

  if (rulesError) {
    errors.push(`定期投稿ルールの取得に失敗しました: ${rulesError.message}`);
    return { generated, errors };
  }

  for (const rule of rules || []) {
    try {
      if (rule.end_date && rule.end_date < todayStr) continue;
      if (!Array.isArray(rule.days_of_week) || !rule.days_of_week.includes(jstDow)) continue;

      // 既に本日分が生成済みかチェック
      const { data: existing } = await supabase
        .from('news_drafts')
        .select('id')
        .eq('recurring_rule_id', rule.id)
        .gte('scheduled_at', dayStartUtc.toISOString())
        .lt('scheduled_at', dayEndUtc.toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      const [hh, mm] = String(rule.time_of_day).split(':').map((v: string) => parseInt(v, 10));
      const scheduledAtUtc = new Date(Date.UTC(jstYear, jstMonth, jstDate, hh || 0, mm || 0, 0) - 9 * 60 * 60 * 1000);

      const { error: insertError } = await supabase.from('news_drafts').insert({
        shop_id: rule.shop_id,
        target_site: rule.target_site || 'esthe_ranking',
        news_type: rule.news_type,
        title: rule.title,
        content: rule.content,
        image_url: rule.image_url,
        scheduled_at: scheduledAtUtc.toISOString(),
        status: 'pending',
        recurring_rule_id: rule.id,
      });

      if (insertError) {
        errors.push(`ルール(${rule.id})からの記事生成に失敗しました: ${insertError.message}`);
        continue;
      }

      generated++;
    } catch (e: any) {
      errors.push(`ルール(${rule.id})の処理でエラー: ${e.message}`);
    }
  }

  return { generated, errors };
}
