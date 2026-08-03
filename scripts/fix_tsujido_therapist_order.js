const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.trim();
});

const url = envVars.NEXT_PUBLIC_SUPABASE_URL || 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, serviceKey);

async function run() {
  console.log('Fixing Tsujido Chigasaki therapist order...');

  // Desired order based on Therapist Management screenshot
  const targetNames = [
    'いとう安奈',
    '吉沢りょうか',
    '桜木あや',
    '山手のぞみ',
    '渋谷あいり',
    '森みいこ',
    '南野もも',
    '藤原ゆう',
    '藤咲みほ',
    '唯月みあ',
    '中村れいあ',
    '大和さくら子',
  ];

  for (let i = 0; i < targetNames.length; i++) {
    const name = targetNames[i];
    const { data, error } = await supabase
      .from('therapists')
      .update({ order: i })
      .eq('name', name);

    if (error) {
      console.error(`Error updating ${name}:`, error);
    } else {
      console.log(`Updated ${name} to order: ${i}`);
    }
  }

  console.log('✅ Therapist order update completed!');
}

run().catch(console.error);
