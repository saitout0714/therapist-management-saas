require('dotenv').config({ path: '.env.local' });
const { calculateBack } = require('../lib/calculateBack');

// モックのSupabaseクライアントを作成
function createMockSupabase(mockData) {
  const queryBuilder = (table) => {
    return {
      select: (columns) => {
        const chain = {
          eq: (col, val) => {
            chain.filterFuncs.push((row) => row[col] === val);
            return chain;
          },
          in: (col, vals) => {
            chain.filterFuncs.push((row) => vals.includes(row[col]));
            return chain;
          },
          is: (col, val) => {
            chain.filterFuncs.push((row) => row[col] === val);
            return chain;
          },
          limit: (l) => {
            const data = mockData[table] || [];
            const filtered = data.filter(row => chain.filterFuncs.every(f => f(row)));
            return Promise.resolve({ data: filtered.slice(0, l), error: null });
          },
          then: (resolve, reject) => {
            const data = mockData[table] || [];
            const filtered = data.filter(row => chain.filterFuncs.every(f => f(row)));
            resolve({ data: filtered, error: null });
          }
        };
        chain.filterFuncs = [];
        return chain;
      }
    };
  };

  return {
    from: queryBuilder
  };
}

async function runTests() {
  console.log("=== RUNNING OPTION BACK PRIORITY TESTS ===");

  const shopId = 'test-shop-id';
  const therapistId = 'test-therapist-id';
  const optionId = 'opt-costume-id';

  // 1. 店舗の基本設定: option_calc_type = 'full_back' (デフォルトはフルバック)
  // 2. オプションマスタ: '衣装チェンジ' (option_id=opt-costume-id), price=3000, back_amount=1000
  // 3. セラピストの個別設定: 「本指名 (confirmed)」のときだけ「衣装」カテゴリのバック率「100% (1.0)」
  const mockData = {
    shop_back_rules: [
      {
        shop_id: shopId,
        course_calc_type: 'fixed',
        course_back_rate: 0,
        course_back_amount: 5000,
        option_calc_type: 'full_back',
        option_back_rate: 100,
        option_back_amount: 0,
        nomination_calc_type: 'full_back',
        nomination_back_rate: 100,
        rounding_method: 'floor',
        business_day_cutoff: '06:00:00'
      }
    ],
    options: [
      {
        id: optionId,
        shop_id: shopId,
        name: '衣装チェンジ',
        back_category: '衣装',
        back_amount: 1000,
        price: 3000
      }
    ],
    option_back_rules: [], // 個別ルールなし
    therapist_option_backs: [
      {
        shop_id: shopId,
        therapist_id: therapistId,
        option_category: '衣装',
        designation_type: 'confirmed', // 本指名のみ
        back_rate: 1.0 // フルバック
      }
    ],
    course_back_amounts: [],
    designation_types: [
      { id: 'dt-free', shop_id: shopId, slug: 'free', display_name: 'フリー', treats_as_confirmed: false },
      { id: 'dt-first', shop_id: shopId, slug: 'first_nomination', display_name: '初回指名', treats_as_confirmed: false },
      { id: 'dt-conf', shop_id: shopId, slug: 'confirmed', display_name: '本指名', treats_as_confirmed: false }
    ],
    therapist_back_overrides: [],
    deduction_rules: []
  };

  const mockSupabase = createMockSupabase(mockData);

  // --- テストケース 1: 初回指名 (first_nomination) ---
  // 期待値: セラピストの個別設定（本指名用）はマッチせず、オプションマスタ設定の back_amount (1000円) が適用されること
  console.log("\n--- TEST CASE 1: First Nomination ---");
  const inputFirst = {
    shopId,
    therapistId,
    therapistRankId: null,
    therapistBackCalcType: 'fixed',
    courseId: 'test-course-id',
    coursePrice: 10000,
    courseBackAmount: 5000,
    courseDuration: 90,
    designationType: 'first_nomination',
    nominationFee: 1000,
    options: [{ option_id: optionId, price: 3000 }],
    discounts: [],
    date: '2026-07-02',
    startTime: '12:00',
    supabaseClient: mockSupabase
  };

  const resFirst = await calculateBack(inputFirst);
  console.log("Calculated Option Back:", resFirst.optionBack);
  console.log("Option Details:", resFirst.optionDetails);
  
  if (resFirst.optionBack === 1000) {
    console.log("✅ PASS: Correctly applied option master back_amount (1000) instead of full_back (3000).");
  } else {
    console.error("❌ FAIL: Expected optionBack to be 1000, but got:", resFirst.optionBack);
  }

  // --- テストケース 2: 本指名 (confirmed) ---
  // 期待値: セラピストの個別設定「本指名でフルバック」がマッチし、料金と同額 of 3000円 が適用されること
  console.log("\n--- TEST CASE 2: Confirmed Nomination ---");
  const inputConf = {
    ...inputFirst,
    designationType: 'confirmed'
  };

  const resConf = await calculateBack(inputConf);
  console.log("Calculated Option Back:", resConf.optionBack);
  console.log("Option Details:", resConf.optionDetails);

  if (resConf.optionBack === 3000) {
    console.log("✅ PASS: Correctly applied therapist individual option back (3000) for confirmed nomination.");
  } else {
    console.error("❌ FAIL: Expected optionBack to be 3000, but got:", resConf.optionBack);
  }
}

runTests().catch(console.error);
