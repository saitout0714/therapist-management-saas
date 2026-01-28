const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function initServiceData() {
  try {
    console.log('🚀 Initializing service data...\n');

    // コースデータ
    console.log('📝 Inserting courses...');
    const courses = [
      { name: '60分コース', duration: 60, base_price: 6000, description: 'スタンダードな60分の施術コース', display_order: 1 },
      { name: '90分コース', duration: 90, base_price: 9000, description: 'じっくり90分の施術コース', display_order: 2 },
      { name: '120分コース', duration: 120, base_price: 12000, description: 'たっぷり120分の施術コース', display_order: 3 },
      { name: '150分コース', duration: 150, base_price: 15000, description: 'プレミアム150分の施術コース', display_order: 4 },
    ];

    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .insert(courses)
      .select();

    if (coursesError) {
      console.error('❌ Error inserting courses:', coursesError);
    } else {
      console.log(`✅ Inserted ${coursesData.length} courses`);
    }

    // オプションデータ
    console.log('\n📝 Inserting options...');
    const options = [
      { name: '延長30分', duration: 30, price: 3000, description: '施術時間を30分延長', display_order: 1 },
      { name: 'ヘッドマッサージ', duration: 15, price: 1500, description: '頭部の集中ケア', display_order: 2 },
      { name: 'フットケア', duration: 20, price: 2000, description: '足裏の集中ケア', display_order: 3 },
      { name: 'アロマオイル', duration: 0, price: 500, description: 'お好みのアロマオイルを使用', display_order: 4 },
      { name: 'ホットストーン', duration: 0, price: 1000, description: '温かい石を使った施術', display_order: 5 },
    ];

    const { data: optionsData, error: optionsError } = await supabase
      .from('options')
      .insert(options)
      .select();

    if (optionsError) {
      console.error('❌ Error inserting options:', optionsError);
    } else {
      console.log(`✅ Inserted ${optionsData.length} options`);
    }

    // セラピストの指名料設定
    console.log('\n📝 Setting therapist pricing...');
    const { data: therapists, error: therapistsError } = await supabase
      .from('therapists')
      .select('id, name');

    if (therapistsError) {
      console.error('❌ Error fetching therapists:', therapistsError);
    } else if (therapists && therapists.length > 0) {
      const therapistPricing = therapists.map((therapist, index) => ({
        therapist_id: therapist.id,
        nomination_fee: index === 0 ? 1000 : (index === 1 ? 800 : 500), // 例: 1人目は1000円、2人目は800円、他は500円
        is_nomination_required: false,
      }));

      const { data: pricingData, error: pricingError } = await supabase
        .from('therapist_pricing')
        .insert(therapistPricing)
        .select();

      if (pricingError) {
        console.error('❌ Error inserting therapist pricing:', pricingError);
      } else {
        console.log(`✅ Set pricing for ${pricingData.length} therapists`);
      }
    }

    console.log('\n✅ Service data initialization completed!');
    console.log('\n📊 Summary:');
    console.log(`  - Courses: ${coursesData?.length || 0}`);
    console.log(`  - Options: ${optionsData?.length || 0}`);
    console.log(`  - Therapist pricing: ${therapists?.length || 0}`);

  } catch (error) {
    console.error('❌ Failed to initialize service data:', error);
    process.exit(1);
  }
}

initServiceData();
