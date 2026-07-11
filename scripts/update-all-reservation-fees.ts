import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { BackCalculationInput } from '../lib/calculateBack';

// .env.local から環境変数を読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DRY_RUN = process.env.DRY_RUN !== 'false';

// 接続先のデータベースURLを決定 (PRODUCTION優先)
const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DEVELOPMENT_DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined.');
  process.exit(1);
}

if (!dbUrl) {
  console.error('❌ Error: DATABASE_URL must be defined.');
  process.exit(1);
}

async function run() {
  const { calculateBack } = await import('../lib/calculateBack');
  console.log(`🚀 Starting Reservation Fees Validation & Update (Direct Postgres Mode)`);
  console.log(`DATABASE: ${dbUrl.includes('pumkni') ? 'PRODUCTION (pumkni)' : 'DEVELOPMENT (gzxz)'}`);
  console.log(`MODE: ${DRY_RUN ? '🔍 DRY RUN (Simulating changes)' : '💾 LIVE RUN (Database will be updated)'}`);

  const pgClient = new Client({ connectionString: dbUrl });
  await pgClient.connect();

  // RLSを回避する特権Supabaseクライアント（calculateBackが内部で使用する）
  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // 1. 店舗一覧を取得してマップを作成
  const shopRes = await pgClient.query('SELECT id, name FROM shops');
  const shops = shopRes.rows;
  const shopMap = new Map<string, string>();
  shops.forEach(s => shopMap.set(s.id, s.name));

  // 2. 有効な全予約（キャンセル、ブロック以外）を取得 (1000件制限を回避)
  console.log('📡 Fetching active reservations from Postgres...');
  const resRes = await pgClient.query(`
    SELECT 
      r.id,
      r.shop_id,
      r.therapist_id,
      r.course_id,
      r.base_price,
      r.nomination_fee,
      r.discount_amount,
      r.designation_type,
      r.date,
      r.start_time,
      r.end_time,
      r.extension_count,
      r.credit_fee_amount,
      r.total_price,
      r.therapist_back_amount,
      r.shop_revenue,
      (
        SELECT json_build_object('name', co.name, 'duration', co.duration, 'base_price', co.base_price, 'back_amount', co.back_amount)
        FROM courses co WHERE co.id = r.course_id
      ) as course,
      (
        SELECT coalesce(json_agg(json_build_object('option_id', ro.option_id, 'price', ro.price, 'custom_name', ro.custom_name)), '[]'::json)
        FROM reservation_options ro WHERE ro.reservation_id = r.id
      ) as reservation_options,
      (
        SELECT coalesce(json_agg(json_build_object('applied_amount', rd.applied_amount, 'burden_type', rd.burden_type)), '[]'::json)
        FROM reservation_discounts rd WHERE rd.reservation_id = r.id
      ) as reservation_discounts
    FROM reservations r
    WHERE r.status NOT IN ('cancelled', 'blocked')
      AND r.notes ILIKE '%Googleカレンダーよりインポート%'
    ORDER BY r.date DESC
  `);
  
  const reservations = resRes.rows;
  console.log(`Loaded ${reservations.length} active reservations.`);

  // 3. 全セラピストを取得してマップ化
  const therapistRes = await pgClient.query('SELECT id, name, rank_id, back_calc_type FROM therapists');
  const therapists = therapistRes.rows;

  let verifiedCount = 0;
  let updateCount = 0;
  let totalDiffSales = 0;
  let totalDiffBack = 0;
  
  // 店舗ごとの修正件数カウンタ
  const shopStats = new Map<string, { total: number; corrected: number }>();
  shops.forEach(s => shopStats.set(s.id, { total: 0, corrected: 0 }));

  const CHUNK_SIZE = 50;
  for (let i = 0; i < reservations.length; i += CHUNK_SIZE) {
    const chunk = reservations.slice(i, i + CHUNK_SIZE);
    console.log(`⏳ Processing batch ${Math.floor(i / CHUNK_SIZE) + 1} / ${Math.ceil(reservations.length / CHUNK_SIZE)} (Size: ${chunk.length}, Total verified: ${verifiedCount})...`);

    await Promise.all(chunk.map(async (res) => {
      const shopName = shopMap.get(res.shop_id) || '不明な店舗';
      const stats = shopStats.get(res.shop_id) || { total: 0, corrected: 0 };
      stats.total++;
      shopStats.set(res.shop_id, stats);

      verifiedCount++;
      const therapist = therapists.find(t => t.id === res.therapist_id);
      if (!therapist) {
        // セラピスト未割り当ての場合は指名料再計算をスキップ
        return;
      }

      // Postgres DATE型オブジェクトを JST 文字列 YYYY-MM-DD に変換
      let dateStr = '';
      if (res.date instanceof Date) {
        // Postgresから取得した際、Dateオブジェクトになっている場合の補正
        const jstOffset = 9 * 60 * 60 * 1000;
        const jstDate = new Date(res.date.getTime() + jstOffset);
        dateStr = jstDate.toISOString().split('T')[0];
      } else {
        dateStr = String(res.date);
      }

      const input: BackCalculationInput = {
        shopId: res.shop_id,
        therapistId: therapist.id,
        therapistRankId: therapist.rank_id,
        therapistBackCalcType: therapist.back_calc_type,
        courseId: res.course_id,
        coursePrice: res.course?.base_price ?? res.base_price ?? 0,
        courseBackAmount: res.course?.back_amount || 0,
        courseDuration: res.course?.duration || 0,
        designationType: res.designation_type || 'free',
        nominationFee: res.nomination_fee || 0,
        options: (res.reservation_options || []).map((o: any) => ({
          option_id: o.option_id,
          price: o.price,
          custom_name: o.custom_name
        })),
        discounts: res.reservation_discounts || [],
        discountAmount: res.discount_amount || 0,
        date: dateStr,
        startTime: res.start_time.substring(0, 5), // 'HH:MM:SS' => 'HH:MM'
        extensionCount: res.extension_count || 0,
        supabaseClient: adminSupabase
      };

      try {
        const calc = await calculateBack(input);

        // 現在DBに登録されている値と、再計算結果を比較
        const diffTotalPrice = (res.total_price ?? 0) !== calc.totalPrice;
        const diffBackAmount = (res.therapist_back_amount ?? 0) !== calc.netBack;
        const diffRevenue = (res.shop_revenue ?? 0) !== calc.shopRevenue;

        if (diffTotalPrice || diffBackAmount || diffRevenue) {
          updateCount++;
          stats.corrected++;
          shopStats.set(res.shop_id, stats);

          totalDiffSales += (calc.totalPrice - (res.total_price ?? 0));
          totalDiffBack += (calc.netBack - (res.therapist_back_amount ?? 0));

          console.log(`⚠️ Discrepancy Found [${shopName}] Date: ${dateStr} ${res.start_time} - Therapist: ${therapist.name}`);
          console.log(`   - Total Price: DB=${res.total_price} => CALC=${calc.totalPrice} (Diff: ${calc.totalPrice - (res.total_price ?? 0)})`);
          console.log(`   - Therapist Back: DB=${res.therapist_back_amount} => CALC=${calc.netBack} (Diff: ${calc.netBack - (res.therapist_back_amount ?? 0)})`);
          console.log(`   - Shop Revenue: DB=${res.shop_revenue} => CALC=${calc.shopRevenue}`);

          if (!DRY_RUN) {
            // LIVE実行時はDBを直接更新
            await pgClient.query(`
              UPDATE reservations
              SET 
                total_price = $1,
                therapist_back_amount = $2,
                shop_revenue = $3,
                back_calculated_at = $4,
                business_date = $5
              WHERE id = $6
            `, [
              calc.totalPrice,
              calc.netBack,
              calc.shopRevenue,
              new Date().toISOString(),
              calc.businessDate,
              res.id
            ]);
          }
        }
      } catch (err: any) {
        console.error(`❌ Error calculating for reservation ${res.id}:`, err.message);
      }
    }));
  }

  console.log('\n======================================');
  console.log('📊 Verification Summary');
  console.log(`- Verified active reservations: ${verifiedCount}`);
  console.log(`- Reservations with discrepancies (to correct): ${updateCount}`);
  console.log(`- Total Sales Correction: +¥${totalDiffSales.toLocaleString()}`);
  console.log(`- Total Therapist Back Correction: +¥${totalDiffBack.toLocaleString()}`);
  console.log('======================================');
  console.log('🏬 Breakdown by Shop:');
  shopStats.forEach((stat, shopId) => {
    const name = shopMap.get(shopId) || '不明';
    console.log(`- ${name}: Corrected ${stat.corrected} / ${stat.total} active reservations`);
  });
  console.log('======================================');

  await pgClient.end();

  if (DRY_RUN) {
    console.log('\n💡 This was a DRY RUN. No database records were modified.');
    console.log('   To apply the changes, run with DRY_RUN=false');
  } else {
    console.log('\n🎉 Live run completed and database records have been updated.');
  }
}

run().catch(err => {
  console.error('Unexpected execution error:', err);
  process.exit(1);
});

