// course_back_amounts に nomination_back_amount カラムを追加するマイグレーションスクリプト
const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

const dbs = [
  { name: 'PRODUCTION', url: process.env.PRODUCTION_DATABASE_URL },
  { name: 'DEVELOPMENT', url: process.env.DEVELOPMENT_DATABASE_URL }
]

async function runMigration() {
  for (const db of dbs) {
    if (!db.url) {
      console.log(`[${db.name}] URLが設定されていないためスキップします。`)
      continue
    }

    console.log(`[${db.name}] 接続中...`)
    const client = new Client({
      connectionString: db.url,
      ssl: { rejectUnauthorized: false } // Supabase等の接続に必要
    })

    try {
      await client.connect()
      console.log(`[${db.name}] 接続成功。マイグレーションを実行します。`)
      
      // カラム追加SQL
      await client.query(`
        ALTER TABLE course_back_amounts 
        ADD COLUMN IF NOT EXISTS nomination_back_amount INTEGER;
      `)
      
      console.log(`[${db.name}] マイグレーション完了しました！`)
    } catch (err) {
      console.error(`[${db.name}] エラーが発生しました:`, err.message)
    } finally {
      await client.end()
    }
  }
}

runMigration().catch(console.error)
