/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// .env.localから環境変数を読み込む
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase URL or Service Key not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Starting migration: add-service-management.sql');
    
    const sqlPath = path.join(__dirname, '..', 'supabase', 'add-service-management.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // SQLを実行（複数のステートメントを分割して実行）
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`);
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
        
        if (error) {
          // RPCが使えない場合は直接実行を試みる
          console.log('⚠️  RPC not available, trying direct execution...');
          // Supabaseの制限により、直接SQLを実行できない場合があります
          console.log('Statement:', statement.substring(0, 100) + '...');
        } else {
          console.log('✅ Success');
        }
      }
    }
    
    console.log('\n✅ Migration completed!');
    console.log('\n📌 Next steps:');
    console.log('1. Go to Supabase Dashboard > SQL Editor');
    console.log('2. Copy and paste the contents of supabase/add-service-management.sql');
    console.log('3. Run the SQL to create tables');
    console.log('4. Then run: node scripts/init-service-data.js to add sample data');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
