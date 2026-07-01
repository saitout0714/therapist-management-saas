import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const { calculateBack } = require('../lib/calculateBack');
  console.log("=== STARTING BACK CALCULATION TEST ===");

  // タイガーリリーの予約条件を再現
  const input = {
    shopId: '4808aee9-9940-410c-aa5b-dd1364e2da2c', // タイガーリリー
    therapistId: '26fc71ec-eb49-48f8-853a-90353428d338', // 天野 うた
    therapistRankId: null,
    therapistBackCalcType: null,
    courseId: '20c4c6af-992a-45de-9e96-ff86b056f614', // 120分コース (固定バック額 13000)
    coursePrice: 23000,
    courseDuration: 130,
    designationType: 'confirmed', // 本指名
    nominationFee: 1000,
    options: [
      { option_id: '8ebb244e-53e8-41ee-9141-743e72cd5e4a', price: 1000 }, // パウダー
      { option_id: 'a898ec25-d472-4a05-b494-07e3abaa1a26', price: 3000 }  // 衣装
    ],
    discounts: [],
    date: '2026-07-01',
    startTime: '18:00',
    courseBackAmount: 13000 // コースマスタの back_amount
  };

  try {
    const result = await calculateBack(input);

    console.log("=== TEST RESULT ===");
    console.log("Course Back (Expected: 13000):", result.courseBack);
    console.log("Option Back (Expected: 2000):", result.optionBack);
    console.log("Nomination Back (Expected: 0):", result.nominationBack);
    console.log("Total Back (Expected: 15000):", result.totalBack);

    // アサーション
    if (result.courseBack === 13000 && result.optionBack === 2000 && result.nominationBack === 0 && result.totalBack === 15000) {
      console.log("✅ SUCCESS: Calculations are correct!");
      process.exit(0);
    } else {
      console.error("❌ FAILURE: Output does not match expectations!");
      process.exit(1);
    }

  } catch (err) {
    console.error("Error during calculation:", err);
    process.exit(1);
  }
}

test();
